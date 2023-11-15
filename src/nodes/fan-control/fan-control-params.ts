import {
  EntityId,
  EntityShortId,
  FanSpeed6Service,
  FanSpeed6Speed,
  isFanSpeed6Speed,
} from 'epdoc-node-red-hautil';
import { Milliseconds } from 'epdoc-timeutil';
import {
  isInteger,
  isNonEmptyArray,
  isNonEmptyString,
  isNumber,
  isString,
} from 'epdoc-util';

const REG = {
  onoff: new RegExp(/^(on|off)$/, 'i'),
  on: new RegExp(/on$/, 'i'),
  off: new RegExp(/off$/, 'i'),
};

/**
 * Container for Fan Control parameters
 */
export class FanControlParams {
  public debug = false;
  public shortId: EntityShortId;
  public speed: FanSpeed6Speed = 0;
  public service: 'on' | 'off' = 'off';
  public bOn: boolean = false;
  public timeout: Milliseconds = 0;
  public retryDelay: Milliseconds[] = [1000, 3000];
  public shutoffEntityId: EntityId;

  constructor() {}

  setDebug(val: any): this {
    if (val === true) {
      this.debug = true;
    }
    return this;
  }

  setDelay(val: any): this {
    if (isNonEmptyArray(val)) {
      this.retryDelay = val;
    }
    return this;
  }

  setFan(shortId: EntityShortId): this {
    if (isNonEmptyString(shortId)) {
      this.shortId = shortId;
    }
    return this;
  }

  setShutoff(entityId: EntityId | undefined): this {
    if (isNonEmptyString(entityId)) {
      this.shutoffEntityId = entityId;
    }
    return this;
  }

  setSpeed(speed: FanSpeed6Speed | undefined): this {
    if (isFanSpeed6Speed(speed)) {
      this.speed = speed;
      if (this.speed === 0) {
        return this.off();
      }
    }
    return this;
  }

  setPercentage(pct: number | undefined): this {
    if (isNumber(pct)) {
      this.speed = FanSpeed6Service.percentageToSpeed(pct);
    }
    return this;
  }

  setService(val: 'on' | 'off' | string | undefined): this {
    if (isString(val)) {
      if (REG.on.test(val)) {
        return this.on();
      } else if (REG.off.test(val)) {
        return this.off();
      }
    }
    return this;
  }

  setTimeout(val: Milliseconds | undefined): this {
    if (isInteger(val)) {
      this.timeout = val;
    }
    return this;
  }

  on(val: boolean = true): this {
    this.service = val ? 'on' : 'off';
    this.bOn = val;
    return this;
  }

  off(val: boolean = true): this {
    this.service = val ? 'off' : 'on';
    this.bOn = val ? false : true;
    return this;
  }

  shouldTurnOff(): boolean {
    return this.bOn !== true || this.speed === 0;
  }
  shouldTurnOn(): boolean {
    return this.bOn === true || this.speed > 0;
  }

  shouldTimeout(): boolean {
    return this.shouldTurnOn() && this.timeout > 0;
  }
}
