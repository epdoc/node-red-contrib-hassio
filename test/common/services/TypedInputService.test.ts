import chai, { expect } from 'chai';
import { afterEach, before } from 'mocha';
import sinonChai from 'sinon-chai';
import sinon, { StubbedInstance, stubInterface } from 'ts-sinon';

import JSONataService from '../../../src/common/services/JSONataService';
import NodeRedContextService from '../../../src/common/services/NodeRedContextService';
import TypedInputService from '../../../src/common/services/TypedInputService';
import { TypedInputTypes } from '../../../src/const';
import { resetStubInterface } from '../../helpers';

chai.use(sinonChai);

const nodeConfig = {
  id: 'test',
  type: 'ha-test',
  name: 'test node',
};

describe('Typed Input Service', function () {
  let contextServiceStub: StubbedInstance<NodeRedContextService>;
  let jsonataServiceStub: StubbedInstance<JSONataService>;
  let typedInputService: TypedInputService;

  before(function () {
    contextServiceStub = stubInterface<NodeRedContextService>();
    jsonataServiceStub = stubInterface<JSONataService>();
    typedInputService = new TypedInputService({
      nodeConfig,
      context: contextServiceStub,
      jsonata: jsonataServiceStub,
    });
  });

  afterEach(function () {
    sinon.restore();
    resetStubInterface(contextServiceStub);
    resetStubInterface(jsonataServiceStub);
  });

  describe('getValue', function () {
    it('should return the value of the msg property', function () {
      const message = { payload: 'bar' };
      contextServiceStub.get.withArgs('msg', 'payload', message).returns('bar');
      const results = typedInputService.getValue(
        'payload',
        TypedInputTypes.Message,
        {
          message,
        }
      );

      expect(contextServiceStub.get).to.have.been.calledOnceWithExactly(
        'msg',
        'payload',
        message
      );
      expect(results).to.equal('bar');
    });
    it('should return the value of the flow property', function () {
      contextServiceStub.get.withArgs('flow', 'payload').returns('bar');
      const results = typedInputService.getValue(
        'payload',
        TypedInputTypes.Flow
      );

      expect(results).to.equal('bar');
    });
    it('should return the value of the global property', function () {
      contextServiceStub.get.withArgs('global', 'payload').returns('bar');
      const results = typedInputService.getValue(
        'payload',
        TypedInputTypes.Global
      );

      expect(results).to.equal('bar');
    });
    describe('bool', function () {
      it('should return true when type is set to bool and value "true"', function () {
        const results = typedInputService.getValue(
          'true',
          TypedInputTypes.Boolean
        );
        expect(results).to.be.true;
      });
      it('should return false when type is set to bool and value "false"', function () {
        const results = typedInputService.getValue(
          'false',
          TypedInputTypes.Boolean
        );
        expect(results).to.be.false;
      });
      it('should return false when type is set to bool and value is not "true"', function () {
        const results = typedInputService.getValue(
          'foo',
          TypedInputTypes.Boolean
        );
        expect(results).to.be.false;
      });
    });
    describe('json', function () {
      it('should return the value of the json property', function () {
        const results = typedInputService.getValue(
          '{"foo": "bar"}',
          TypedInputTypes.JSON
        );
        expect(results).to.deep.equal({ foo: 'bar' });
      });
      it('should catch errors silently when parsing the json', function () {
        const results = typedInputService.getValue(
          '{"foo": "bar"',
          TypedInputTypes.JSON
        );
        expect(results).to.be.undefined;
      });
    });
    it('should return the current timestamp', function () {
      const clock = sinon.useFakeTimers(Date.now());
      const results = typedInputService.getValue('', TypedInputTypes.Date);
      expect(results).to.equal(clock.now);
      clock.restore();
    });
    it('should return a number', function () {
      const results = typedInputService.getValue('1', TypedInputTypes.Number);
      expect(results).to.equal(1);
    });
    it('should return undefined when type set to "none"', function () {
      const results = typedInputService.getValue('', TypedInputTypes.None);
      expect(results).to.be.undefined;
    });
    it('should retun a string', function () {
      const results = typedInputService.getValue('foo', TypedInputTypes.String);
      expect(results).to.equal('foo');
    });
    describe('JSONata', function () {
      it('should return undefined when value is empty', function () {
        const results = typedInputService.getValue('', TypedInputTypes.JSONata);
        expect(results).to.be.undefined;
      });
      it('should throw an error when the expression is invalid', function () {
        jsonataServiceStub.evaluate.withArgs('foo').throws(new Error());
        expect(() => {
          typedInputService.getValue('foo', TypedInputTypes.JSONata);
        }).to.throw(Error);
      });
      it('should pass the correct properties to the JSONata service', function () {
        const objs = {
          data: { foo: 'bar2' },
          entity: { foo: 'bar' },
          entityId: 'light.light',
          eventData: { foo: 'bar3' },
          message: { payload: 'bar' },
          prevEntity: { foo: 'bar4' },
          results: 'hello',
        };
        jsonataServiceStub.evaluate.withArgs('foo').resolves('bar');
        const results = typedInputService.getValue(
          'foo',
          TypedInputTypes.JSONata,
          objs
        );

        expect(jsonataServiceStub.evaluate).to.have.been.calledOnceWithExactly(
          'foo',
          objs
        );
        expect(results).to.equal('bar');
      });
    });
    describe('config', function () {
      it('should return the id value of the config', function () {
        const results = typedInputService.getValue(
          'id',
          TypedInputTypes.Config
        );
        expect(results).to.equal('test');
      });
      it('should return the name value of the config', function () {
        const results = typedInputService.getValue(
          'name',
          TypedInputTypes.Config
        );
        expect(results).to.equal('test node');
      });
      it('should return the complete config when value is empty', function () {
        const results = typedInputService.getValue('', TypedInputTypes.Config);
        expect(results).to.deep.equal({
          id: 'test',
          type: 'ha-test',
          name: 'test node',
        });
      });
    });
    describe('custom ouput properties', function () {
      const props: Partial<Record<TypedInputTypes, any>> = {
        data: 'data_value',
        entity: 'entity_value',
        entityState: 'entityState_value',
        eventData: 'eventData_value',
        headers: 'headers_value',
        params: 'params_value',
        triggerId: 'triggerId_value',
        prevEntity: 'prevEntity_value',
        results: 'results_value',
      };
      it('should return the prop value for a given prop', function () {
        const properties = Object.keys(props) as TypedInputTypes[];
        properties.forEach((prop) => {
          const results = typedInputService.getValue('', prop, props);
          expect(results).to.equal(prop + '_value');
        });
      });
    });
  });
});
