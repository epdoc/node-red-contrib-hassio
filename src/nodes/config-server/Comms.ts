import { HassEntities, HassServices } from 'home-assistant-js-websocket';

import ClientEvents from '../../common/events/ClientEvents';
import { RED } from '../../globals';
import { HaEvent } from '../../homeAssistant';
import HomeAssistant from '../../homeAssistant/HomeAssistant';
import { ClientEvent } from '../../homeAssistant/Websocket';
import {
  HassAreas,
  HassDevices,
  HassEntityRegistryEntry,
  HassStateChangedEvent,
} from '../../types/home-assistant';

const convertSetToArray = (obj: { [key: string]: Set<string> }) => {
  const result: { [key: string]: string[] } = {};
  Object.keys(obj).forEach((key) => {
    result[key] = Array.from(obj[key]);
  });
  return result;
};

export default class Comms {
  readonly #clientEvents: ClientEvents;
  readonly #homeAssistant: HomeAssistant;
  readonly #serverId: string;

  constructor(
    serverId: string,
    homeAssistant: HomeAssistant,
    clientEvents: ClientEvents
  ) {
    this.#clientEvents = clientEvents;
    this.#homeAssistant = homeAssistant;
    this.#serverId = serverId;

    this.startListeners();
  }

  startListeners(): void {
    this.#clientEvents.addListeners(this, [
      [HaEvent.ServicesUpdated, this.onServicesUpdated],
      [ClientEvent.StatesLoaded, this.onStatesLoaded],
      ['ha_events:state_changed', this.onStateChanged],
      [ClientEvent.Integration, this.onIntegrationEvent],
      [HaEvent.AreaRegistryUpdated, this.onAreaRegistryUpdate],
      [HaEvent.DeviceRegistryUpdated, this.onDeviceRegistryUpdate],
      [HaEvent.RegistryUpdated, this.onRegistryUpdate],
    ]);
  }

  publish(type: string, data: { [key: string]: any }, retain = true): void {
    RED.comms.publish(`homeassistant/${type}/${this.#serverId}`, data, retain);
  }

  onAreaRegistryUpdate(areas: HassAreas): void {
    this.publish('areas', areas);
  }

  onDeviceRegistryUpdate(devices: HassDevices): void {
    this.publish('devices', devices);
  }

  onRegistryUpdate({
    devices,
    entities,
  }: {
    areas: HassAreas;
    devices: HassDevices;
    entities: HassEntityRegistryEntry[];
  }): void {
    const areaDomains: { [key: string]: Set<string> } = {};
    const deviceDomains: { [key: string]: Set<string> } = {};
    entities.forEach((entity) => {
      if (entity.area_id) {
        if (!(entity.area_id in areaDomains)) {
          areaDomains[entity.area_id] = new Set<string>();
        }
        areaDomains[entity.area_id].add(entity.entity_id.split('.')[0]);
      }
      if (entity.device_id) {
        if (!(entity.device_id in deviceDomains)) {
          deviceDomains[entity.device_id] = new Set<string>();
        }
        deviceDomains[entity.device_id].add(entity.entity_id.split('.')[0]);
      }
    });

    devices.forEach((device) => {
      if (device.area_id) {
        if (!(device.area_id in areaDomains)) {
          areaDomains[device.area_id] = new Set<string>();
        }
        areaDomains[device.area_id] = new Set([
          ...areaDomains[device.area_id],
          ...(deviceDomains[device.id] ?? []),
        ]);
      }
    });

    this.publish('targetDomains', {
      areas: convertSetToArray(areaDomains),
      devices: convertSetToArray(deviceDomains),
    });
  }

  onIntegrationEvent(eventType: string): void {
    this.publish('integration', {
      event: eventType,
      version: this.#homeAssistant.integrationVersion,
    });
  }

  onServicesUpdated(services: HassServices): void {
    this.publish('services', services);
  }

  onStateChanged(event: HassStateChangedEvent): void {
    const entity = event.event.new_state;
    if (entity) {
      this.publish('entity', entity);
    }
  }

  onStatesLoaded(entities: HassEntities): void {
    this.publish('entities', entities);
  }
}
