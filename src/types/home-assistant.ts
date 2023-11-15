/* eslint-disable camelcase */
import {
  HassEntity as HomeAssistantEntity,
  HassEventBase,
} from 'home-assistant-js-websocket';

import { DeviceCapabilityType } from '../const';

export type HassArea = {
  area_id: string;
  name: string;
  picture?: string;
};

export type HassAreas = HassArea[];

export type HassDevice = {
  area_id?: string;
  config_entries?: string[];
  connections?: any[];
  disabled_by?: string;
  entry_type: string;
  id: string;
  identifiers?: string[][];
  manufacturer?: string;
  model?: string;
  name: string;
  name_by_user?: string;
  sw_version?: string;
  via_device_id?: string;
};

export type HassDevices = HassDevice[];

export type HassTag = {
  id: string;
  last_scanned: string;
  name: string;
  tag_id: string;
};

export type HassTags = HassTag[];

export type HassTranslation = {
  [id: string]: string;
};

export type HassTranslations = HassTranslation[];

export interface HassDeviceCapability {
  name: string;
  type: DeviceCapabilityType;
  value: unknown;
  unit: string;
}
export type HassDeviceCapabilities = HassDeviceCapability[];

export interface HassDeviceTrigger {
  device_id: string;
  domain: string;
  entity_id: string;
  metadata: Record<string, unknown>;
  platform: 'device';
  type: string;
}

export type HassDeviceTriggers = HassDeviceTrigger[];

export type SubscriptionUnsubscribe = () => Promise<void>;

export type HassIntegrationEvent = {
  type: string;
  version: string;
};

export type HassDeviceAction = {
  type: string;
  device_id: string;
  entity_id: string;
  domain: string;
};

export type HassDeviceActions = HassDeviceAction[];

export type HassData = {
  [key: string]: any;
};

export type HassEntity = Omit<HomeAssistantEntity, 'state'> & {
  original_state: string;
  state: string | number | boolean | RegExp | string[];
  timeSinceChangedMs: number;
};

export type HassEvent = HassEventBase & {
  event_type: string;
  event: {
    [key: string]: any;
  };
};

export type HassStateChangedEvent = HassEventBase & {
  event_type: string;
  entity_id: string;
  event: {
    entity_id: string;
    new_state: HassEntity | null;
    old_state: HassEntity | null;
  };
};

export interface HassEntityRegistryEntry {
  entity_id: string;
  name?: string;
  icon?: string;
  platform?: string;
  config_entry_id?: string;
  device_id?: string;
  area_id?: string;
  disabled_by?: string;
  entity_category?: 'config' | 'diagnostic';
}

type HassEntityCategory = 'config' | 'diagnostic';

export interface HassEntityRegistryDisplayEntryResponse {
  entities: {
    ei: string;
    di?: string;
    ai?: string;
    ec?: number;
    en?: string;
    pl?: string;
    tk?: string;
    hb?: boolean;
    dp?: number;
  }[];
  entity_categories: Record<number, HassEntityCategory>;
}
export interface HassEntityRegistryDisplayEntry {
  entity_id: string;
  name?: string;
  device_id?: string;
  area_id?: string;
  hidden?: boolean;
  entity_category?: HassEntityCategory;
  translation_key?: string;
  platform?: string;
  display_precision?: number;
}
