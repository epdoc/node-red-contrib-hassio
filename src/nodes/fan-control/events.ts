import ClientEvents from '../../common/events/ClientEvents';
import HomeAssistant from '../../homeAssistant/HomeAssistant';
import { FanControlNode } from '.';
import FanControlController from './fan-control-controller';

export function startListeners(
  clientEvents: ClientEvents,
  controller: FanControlController,
  homeAssistant: HomeAssistant,
  node: FanControlNode
) {
  const eventTopic = `ha_events:state_changed:${node.config.entityId}`;

  clientEvents.addListener(
    eventTopic,
    controller.onHaFanControlChanged.bind(controller)
  );
}
