import { createControllerDependencies } from '../../common/controllers/helpers';
import ConfigError from '../../common/errors/ConfigError';
import ClientEvents from '../../common/events/ClientEvents';
import ComparatorService from '../../common/services/ComparatorService';
import EventsStatus from '../../common/status/EventStatus';
import { StatusColor, StatusShape } from '../../common/status/Status';
import TransformState, { TransformType } from '../../common/TransformState';
import { TypedInputTypes } from '../../const';
import { RED } from '../../globals';
import { migrate } from '../../helpers/migrate';
import { getExposeAsConfigNode, getServerConfigNode } from '../../helpers/node';
import { getHomeAssistant } from '../../homeAssistant';
import {
  BaseNode,
  BaseNodeProperties,
  OutputProperty,
} from '../../types/nodes';
import { startListeners } from './events';
import EventsStateController from './EventsStateController';

export interface EventsStateNodeProperties extends BaseNodeProperties {
  exposeAsEntityConfig: string;
  entityId: string | string[];
  entityIdType: string;
  outputInitially: boolean;
  stateType: TransformType;
  ifState: string;
  ifStateType: string;
  ifStateOperator: string;
  outputOnlyOnStateChange: boolean;
  for: string;
  forType: TypedInputTypes;
  forUnits: string;
  ignorePrevStateNull: boolean;
  ignorePrevStateUnknown: boolean;
  ignorePrevStateUnavailable: boolean;
  ignoreCurrentStateUnknown: boolean;
  ignoreCurrentStateUnavailable: boolean;
  outputProperties: OutputProperty[];
}

export interface EventsStateNode extends BaseNode {
  config: EventsStateNodeProperties;
  status: (params: any) => void;
}

export default function eventsStateNode(
  this: EventsStateNode,
  config: EventsStateNodeProperties
) {
  // @ts-ignore type not defined
  RED.nodes.createNode(this, config);

  this.config = migrate(config);

  if (!this.config?.entityId) {
    const error = new ConfigError(
      'server-state-changed.error.entity_id_required'
    );
    this.status({
      fill: StatusColor.Red,
      shape: StatusShape.Ring,
      text: error.statusMessage,
    });
    throw error;
  }

  const serverConfigNode = getServerConfigNode(this.config.server);
  const homeAssistant = getHomeAssistant(serverConfigNode);
  const exposeAsConfigNode = getExposeAsConfigNode(
    this.config.exposeAsEntityConfig
  );
  const clientEvents = new ClientEvents({
    node: this,
    emitter: homeAssistant.eventBus,
  });

  const status = new EventsStatus({
    clientEvents,
    config: serverConfigNode.config,
    exposeAsEntityConfigNode: exposeAsConfigNode,
    node: this,
  });
  clientEvents.setStatus(status);
  const controllerDeps = createControllerDependencies(this, homeAssistant);
  const transformState = new TransformState(serverConfigNode.config.ha_boolean);
  const comparatorService = new ComparatorService({
    nodeRedContextService: controllerDeps.nodeRedContextService,
    homeAssistant,
    jsonataService: controllerDeps.jsonataService,
    transformState,
  });

  const controller = new EventsStateController({
    comparatorService,
    node: this,
    status,
    transformState,
    ...controllerDeps,
  });
  controller.setExposeAsConfigNode(exposeAsConfigNode);

  startListeners(clientEvents, controller, homeAssistant, this, status);
}
