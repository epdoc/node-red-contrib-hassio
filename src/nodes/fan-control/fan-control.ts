import {
  Entity,
  EntityId,
  EntityService,
  EntityShortId,
  EntityShortService,
  FanSpeed6Speed,
  HA,
  newFanSpeed6Service,
  newSwitchService,
  NodeRedDoneFunction,
  NodeRedLogFunction,
  NodeRedNodeApi,
  NodeRedSendFunction,
  ServicePayload,
} from 'epdoc-node-red-hautil';
import { Milliseconds } from 'epdoc-timeutil';
import { delayPromise, Integer, isDict, isNonEmptyString } from 'epdoc-util';
import {
  Node,
  NodeContext,
  NodeContextData,
  NodeDef,
  NodeMessage,
} from 'node-red';

import { FanControlParams } from './fan-control-params';

const REG = {
  // @ts-ignore
  onoff: new RegExp(/^(on|off)$/, 'i'),
  // @ts-ignore
  on: new RegExp(/on$/, 'i'),
  // @ts-ignore
  off: new RegExp(/off$/, 'i'),
};

export type FanListItem = {
  entityShortId: EntityShortId;
  name: string;
};

export type PayloadSendFunction = (
  payload: ServicePayload
) => void | Promise<void>;
export type FanRunParams = {
  fan: EntityShortId;
  speed?: FanSpeed6Speed;
  percentage?: number;
  service?: EntityService | EntityShortService;
  timeout?: Milliseconds;
  shutOffEntityId?: EntityId;
  delay?: Milliseconds[];
  debug?: boolean;
};
export function isFanRunParams(val: any): val is FanRunParams {
  return isDict(val) && isNonEmptyString(val.fan);
}
type FanControlLogFunctions = {
  debug: NodeRedLogFunction;
};
export type FanControlUiConfig = {
  fan: EntityShortId;
  service: 'on' | 'off';
  speed: Integer;
  timeout: Milliseconds;
  debug: boolean;
};
export function isFanControlUiConfig(val: any): val is FanControlUiConfig {
  return val && REG.onoff.test(val.service);
}

export class FanControl {
  protected _node: Node;
  protected _context: NodeContext;
  protected node: NodeRedNodeApi;
  protected log: FanControlLogFunctions = {
    debug: () => {},
  };

  protected opts: FanControlParams = new FanControlParams();
  private _msg: NodeMessage;
  private _nodeSend: NodeRedSendFunction;
  private _nodeDone: NodeRedDoneFunction;
  protected _ha: HA;
  private _shutoff: boolean = false;
  protected _fan: Entity;
  protected _switch: Entity;

  constructor(
    node: Node,
    msg: NodeMessage,
    send: NodeRedSendFunction,
    done: NodeRedDoneFunction
  ) {
    this._node = node;
    this._ha = new HA(this.global);
    this._msg = msg;
    this._nodeSend = send;
    this._nodeDone = done;
  }

  get global(): NodeContextData {
    return this._node.context().global;
  }

  get flow(): NodeContextData {
    return this._node.context().flow;
  }

  getFanList(): FanListItem[] {
    return this.global.get('fan_control_fan_list') as FanListItem[];
  }

  setUiConfig(config?: NodeDef): this {
    if (isFanControlUiConfig(config)) {
      this.opts
        .setDebug(config.debug)
        .setFan(config.fan)
        .setSpeed(config.speed)
        .setService(config.service)
        .setTimeout(config.timeout);
      this.initAfter();
    }
    return this;
  }

  setPayloadConfig(params?: any): this {
    if (isFanRunParams(params)) {
      this.opts
        .setDebug(params.debug)
        .setFan(params.fan)
        .setShutoff(params.shutOffEntityId)
        .setSpeed(params.speed)
        .setPercentage(params.percentage)
        .setService(params.service)
        .setTimeout(params.timeout)
        .setDelay(params.delay);
      this.initAfter();
      this.log.debug(`setFan input params: ${JSON.stringify(params)}`);

      this.log.debug(
        `setFan ${this.opts.service.toUpperCase()} speed=${
          this.opts.speed
        } timeout=${this.opts.timeout}`
      );
    }
    return this;
  }

  initAfter(): this {
    if (this.opts.debug === true) {
      this.log.debug = this.node.warn;
    }
    if (isNonEmptyString(this.opts.shortId)) {
      const fanId: EntityId = 'fan.' + this.opts.shortId;
      const switchId: EntityId = fanId;
      this._fan = this._ha.entity(fanId);
      this._switch = this._ha.entity(switchId);
    }
    if (isNonEmptyString(this.opts.shutoffEntityId)) {
      const entity: Entity = this._ha.entity(this.opts.shutoffEntityId);
      if (entity.isValid() && entity.isOn()) {
        this._shutoff = true;
      } else {
        this.node.error(`Entity ${this.opts.shutoffEntityId} not found`);
      }
    }
    return this;
  }

  serviceSend(payload: any) {
    this._nodeSend([null, { payload }]);
  }

  done() {
    this._nodeSend([this._msg, null]);
    this._nodeDone();
  }

  isValid(): boolean {
    return Entity.isEntity(this._fan) && Entity.isEntity(this._switch);
  }

  get fanId(): EntityId {
    return this._fan.entityId || 'undefined';
  }

  get switchId(): EntityId {
    return this._switch.entityId || 'undefined';
  }

  /**
   * Custom Node-RED function code for controlling a fan where (i) the fan on/off
   * is controlled by a switch (ii) the fan speed is controlled by a Bond Bridge
   * that sends out RF signals to the fan. Supports reading the state of an input
   * boolean that will keep the fan off. This can be used, for example, when there
   * is a lightning storm and you wish to keep the fan switched off at it's
   * switch.
   */
  run(params?: FanRunParams): Promise<void> {
    this.setPayloadConfig(params);
    if (this.isValid()) {
      let bTurnedOn = false;

      return Promise.resolve()
        .then(() => {
          this.log.debug(`${this.switchId} is ${this._switch.state()}`);
          this.log.debug(`Shutoff (lightning) is ${this._shutoff}`);
          if (
            this._switch.isOn() &&
            (this._shutoff || this.opts.shouldTurnOff())
          ) {
            this.log.debug(`Turn off ${this.fanId}`);
            const payload: ServicePayload = newFanSpeed6Service(
              this.opts.shortId
            )
              .off()
              .payload();
            this.serviceSend(payload);
            this._node.status({
              fill: 'green',
              shape: 'ring',
              text: `Turn off ${this.fanId}`,
            });
          } else {
            this.log.debug(
              `Fan ${
                this.fanId
              } is ${this._switch.state()}, no need to turn off`
            );
          }
          if (
            !this._switch.isOn() &&
            !this._shutoff &&
            this.opts.shouldTurnOn()
          ) {
            this.log.debug(`Turn on ${this.switchId} because fan was off`);
            const payload = newSwitchService(this.switchId).on().payload();
            this.serviceSend(payload);
            bTurnedOn = true;
            this._node.status({
              fill: 'green',
              shape: 'dot',
              text: `Turned on ${this.fanId}`,
            });
          } else {
            this.log.debug(`Fan ${this.fanId} is already on`);
          }
          if (!this._shutoff && this.opts.speed > 0 && bTurnedOn) {
            this.log.debug(
              `1st delay of ${this.opts.retryDelay[0]} for ${this.switchId}`
            );
            return delayPromise(this.opts.retryDelay[0]);
          } else {
            return Promise.resolve();
          }
        })
        .then(() => {
          if (!this._shutoff && this.opts.speed > 0) {
            this.log.debug(
              `1st set fan speed to ${this.opts.speed} for ${this.fanId}`
            );
            const payload = newFanSpeed6Service(this.opts.shortId)
              .speed(this.opts.speed)
              .payload();
            this.serviceSend(payload);
            this.log.debug(
              `2nd delay of ${this.opts.retryDelay[1]} for ${this.switchId}`
            );
            this._node.status({
              fill: 'blue',
              shape: 'dot',
              text: `Set ${this.fanId} to ${this.opts.speed}`,
            });
            return delayPromise(this.opts.retryDelay[1]);
          } else {
            this.log.debug(
              `Skipping set speed step and first delay for ${this.fanId}`
            );
            return Promise.resolve();
          }
        })
        .then(() => {
          if (!this._shutoff && this.opts.speed > 0) {
            this.log.debug(
              `2nd set fan speed to ${this.opts.speed} for ${this.fanId}`
            );
            const payload = newFanSpeed6Service(this.opts.shortId)
              .speed(this.opts.speed)
              .payload();
            this.serviceSend(payload);
            this._node.status({
              fill: 'blue',
              shape: 'ring',
              text: `Set ${this.fanId} to ${this.opts.speed}`,
            });
          }
          return Promise.resolve();
        })
        .then(() => {
          if (this.opts.shouldTimeout() && !this._shutoff) {
            this.log.debug(`timeout ${this.opts.timeout} for ${this.switchId}`);
            this._node.status({
              fill: 'yellow',
              shape: 'ring',
              text: `${this.fanId} waiting ${this.opts.timeout} ms`,
            });
            return delayPromise(this.opts.timeout);
          } else {
            return Promise.resolve();
          }
        })
        .then(() => {
          if (this.opts.shouldTimeout() && !this._shutoff) {
            this.log.debug(`timeout turn off for ${this.switchId}`);
            const payload = newSwitchService(this.switchId).off().payload();
            this.serviceSend(payload);
            this._node.status({
              fill: 'green',
              shape: 'ring',
              text: `Turn off ${this.fanId}`,
            });
          }
          return Promise.resolve();
        })
        .catch((err) => {
          return Promise.reject(err);
        });
    } else {
      const err: Error = new Error('FanControl invalid input parameters');
      this._node.error(err.message);
      this._node.status({
        fill: 'red',
        shape: 'dot',
        text: 'Invalid parameters',
      });
      return Promise.reject(err);
    }
    return Promise.resolve();
  }
}
