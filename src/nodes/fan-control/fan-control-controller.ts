import { HassEntities } from 'home-assistant-js-websocket';
import cloneDeep from 'lodash.clonedeep';

import ExposeAsMixin from '../../common/controllers/ExposeAsMixin';
import OutputController, {
  OutputControllerConstructor,
} from '../../common/controllers/OutputController';
import ConfigError from '../../common/errors/ConfigError';
import ComparatorService from '../../common/services/ComparatorService';
import TransformState, { TransformType } from '../../common/TransformState';
import {
  getTimeInMilliseconds,
  getWaitStatusText,
  shouldIncludeEvent,
} from '../../helpers/utils';
import { HassStateChangedEvent } from '../../types/home-assistant';
import { NodeMessage } from '../../types/nodes';
import { FanControlNode } from '.';

interface FanControlNodeConstructor
  extends OutputControllerConstructor<FanControlNode> {
  comparatorService: ComparatorService;
  transformState: TransformState;
}

enum State {
  Unknown = 'unknown',
  Unavailable = 'unavailable',
}

const ExposeAsController = ExposeAsMixin(OutputController<FanControlNode>);
export default class FanControlController extends ExposeAsController {
  #comparatorService: ComparatorService;
  #topics: Record<string, { timeoutId?: NodeJS.Timeout; active: boolean }> = {};

  #transformState: TransformState;

  constructor(props: FanControlNodeConstructor) {
    super(props);
    this.#comparatorService = props.comparatorService;
    this.#transformState = props.transformState;
  }

  async #getTimerValue() {
    if (this.node.config.for === '') return 0;
    const timer = await this.typedInputService.getValue(
      this.node.config.for,
      this.node.config.forType
    );

    if (isNaN(timer) || timer < 0) {
      throw new ConfigError([
        'server-state-changed.error.invalid_for',
        { for: timer, type: this.node.config.forType },
      ]);
    }

    return Number(timer);
  }

  public async onHaFanControlChanged(
    evt: HassStateChangedEvent,
    runAll = false
  ) {
    if (
      this.isEnabled === false ||
      !this.homeAssistant.isHomeAssistantRunning
    ) {
      return;
    }

    const config = this.node.config;
    const eventMessage = cloneDeep(evt);
    const entityId = eventMessage.entity_id;

    // Track multiple entity ids
    this.#topics[entityId] = this.#topics[entityId] || { active: false };

    const timer = await this.#getTimerValue();

    const validTimer = timer > 0;

    const statusText = getWaitStatusText(timer, this.node.config.forUnits);
    const timeout = getTimeInMilliseconds(timer, this.node.config.forUnits);

    this.status.setText(statusText);

    clearTimeout(this.#topics[entityId].timeoutId);
    this.#topics[entityId] = {
      active: true,
      timeoutId: setTimeout(
        this.output.bind(this, eventMessage, isIfState),
        timeout
      ),
    };
  }

  async output(eventMessage: HassStateChangedEvent, condition: boolean) {
    const config = this.node.config;
    const message: NodeMessage = {};
    await this.setCustomOutputs(config.outputProperties, message, {
      config,
      entity: eventMessage.event.new_state,
      entityState: eventMessage.event.new_state?.state,
      eventData: eventMessage.event,
      prevEntity: eventMessage.event.old_state,
      triggerId: eventMessage.entity_id,
    });

    if (eventMessage.event.new_state) {
      eventMessage.event.new_state.timeSinceChangedMs =
        Date.now() -
        new Date(eventMessage.event.new_state.last_changed).getTime();
    }

    const statusMessage = `${eventMessage.event.new_state?.state}`;

    clearTimeout(this.#topics[eventMessage.entity_id].timeoutId);

    if (config.ifState && !condition) {
      this.status.setFailed(statusMessage);
      this.node.send([null, message]);
      return;
    }

    this.status.setSuccess(statusMessage);
    this.node.send([message, null]);
  }

  public onDeploy() {
    const entities = this.homeAssistant.websocket.getStates();
    this.onStatesLoaded(entities);
  }

  onStatesLoaded(entities: HassEntities) {
    if (!this.isEnabled) return;

    for (const entityId in entities) {
      const eventMessage = {
        event_type: 'state_changed',
        entity_id: entityId,
        event: {
          entity_id: entityId,
          old_state: entities[entityId],
          new_state: entities[entityId],
        },
      };

      this.onHaFanControlChanged(eventMessage as HassStateChangedEvent, true);
    }
  }
}
