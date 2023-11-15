import { Dict } from 'epdoc-util';

import { createControllerDependencies } from '../../common/controllers/helpers';
import ConfigError from '../../common/errors/ConfigError';
import ClientEvents from '../../common/events/ClientEvents';
import ComparatorService from '../../common/services/ComparatorService';
import EventsStatus from '../../common/status/EventStatus';
import { StatusColor, StatusShape } from '../../common/status/Status';
import TransformState from '../../common/TransformState';
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
import { FanControlSpeed } from './editor';
import { startListeners } from './events';
import FanControlController from './fan-control-controller';

export interface FanControlNodeProperties extends BaseNodeProperties {
  entityId: string | string[];
  exposeAsEntityConfig: string;
  speed: FanControlSpeed;
  debug: boolean;
  for: string;
  forType: TypedInputTypes;
  forUnits: string;
  outputProperties: OutputProperty[];
}

export interface FanControlNode extends BaseNode {
  config: FanControlNodeProperties;
  status: (params: Dict) => void;
}

export default function eventsStateNode(
  this: FanControlNode,
  config: FanControlNodeProperties
) {
  // @ts-ignore not defined in types files
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

  const controller = new FanControlController({
    comparatorService,
    node: this,
    status,
    transformState,
    ...controllerDeps,
  });
  controller.setExposeAsConfigNode(exposeAsConfigNode);

  startListeners(clientEvents, controller, homeAssistant, this, status);
}
