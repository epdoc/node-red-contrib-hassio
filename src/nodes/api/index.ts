import { NodeDef } from 'node-red';

import { RED } from '../../globals';
import { migrate } from '../../helpers/migrate';
import { Status } from '../../helpers/status';
import { checkValidServerConfig } from '../../helpers/utils';
import { BaseNode } from '../../types/nodes';
import Api from './controller';

export default function apiNode(this: BaseNode, config: NodeDef) {
  RED.nodes.createNode(this, config);

  this.config = migrate(config);
  checkValidServerConfig(this, this.config.server);
  const status = new Status(this);
  this.controller = new Api({
    node: this,
    config: this.config,
    RED,
    status,
  });
}
