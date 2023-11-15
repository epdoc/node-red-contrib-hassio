import { EditorNodeDef, EditorNodeProperties, EditorRED } from 'node-red';

import { NodeType, TypedInputTypes } from '../../const';
import EntitySelector from '../../editor/components/EntitySelector';
import * as ifState from '../../editor/components/ifstate';
import * as haOutputs from '../../editor/components/output-properties';
import * as exposeNode from '../../editor/exposenode';
import ha, { NodeCategory, NodeColor } from '../../editor/ha';
import * as haServer from '../../editor/haserver';
import { OutputProperty } from '../../editor/types';

declare const RED: EditorRED;

export type FanControlSpeed =
  | 'turn_on'
  | 'turn_off'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6';

interface FanControlEditorNodeProperties extends EditorNodeProperties {
  name: string;
  server: string;
  version: number;
  entityId: string | string[];
  for: string;
  forType: string;
  forUnits: string;
  outputProperties: OutputProperty[];

  speed: FanControlSpeed;
  debug: boolean;
}

const FanControlEditor: EditorNodeDef<FanControlEditorNodeProperties> = {
  category: NodeCategory.HomeAssistant,
  color: NodeColor.HaBlue,
  inputs: 0,
  outputs: 1,
  outputLabels: ["'If State' is true", "'If State' is false"],
  icon: 'ha-events-state-changed.svg',
  paletteLabel: 'events: state',
  label: function () {
    return this.name || `state_changed: ${this.entityId || 'all entities'}`;
  },
  labelStyle: ha.labelStyle,
  defaults: {
    name: { value: '' },
    server: { value: '', type: NodeType.Server, required: true },
    version: { value: RED.settings.get('serverStateChangedVersion', 0) },
    outputs: { value: 1 },
    entityId: { value: '', required: true },
    debug: { value: false },
    speed: { value: 'turn_on' },
    for: { value: '0' },
    forType: { value: 'num' },
    forUnits: { value: 'minutes' },
    outputProperties: {
      value: [
        {
          property: 'payload',
          propertyType: TypedInputTypes.Message,
          value: '',
          valueType: 'entityState',
        },
        {
          property: 'data',
          propertyType: TypedInputTypes.Message,
          value: '',
          valueType: 'eventData',
        },
        {
          property: 'topic',
          propertyType: TypedInputTypes.Message,
          value: '',
          valueType: 'triggerId',
        },
      ],
      validate: haOutputs.validate,
    },
  },
  oneditprepare: function () {
    ha.setup(this);
    haServer.init(this, '#node-input-server', (serverId) => {
      entitySelector.serverChanged(serverId);
    });
    exposeNode.init(this);
    // saveEntityType(EntityType.Switch, 'exposeAsEntityConfig');

    const entitySelector = new EntitySelector({
      filterTypeSelector: '#node-input-entityIdType',
      entityId: this.entityId,
      serverId: haServer.getSelectedServerId(),
    });
    $('#dialog-form').data('entitySelector', entitySelector);

    ifState.init(
      '#node-input-ifState',
      '#node-input-ifStateType',
      '#node-input-ifStateOperator'
    );

    $('#node-input-for').typedInput({
      default: 'num',
      types: ['num', 'jsonata', 'flow', 'global'],
      typeField: '#node-input-forType',
    });

    haOutputs.createOutputs(this.outputProperties, {
      extraTypes: ['eventData', 'entityId', 'entityState'],
    });
  },
  oneditsave: function () {
    const outputs = $('#node-input-ifState').val() ? 2 : 1;
    $('#node-input-outputs').val(outputs);
    this.outputProperties = haOutputs.getOutputs();
    const entitySelector = $('#dialog-form').data(
      'entitySelector'
    ) as EntitySelector;
    this.entityId = entitySelector.entityId;
    entitySelector.destroy();
  },
  oneditcancel: function () {
    const entitySelector = $('#dialog-form').data(
      'entitySelector'
    ) as EntitySelector;
    entitySelector.destroy();
  },
};

export default FanControlEditor;
