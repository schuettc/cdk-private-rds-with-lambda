import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { PrivateRDSWithLambda } from '../src/stacks/private-rds-with-lambda';

test('Snapshot', () => {
  const app = new App();
  const stack = new PrivateRDSWithLambda(app, 'test');

  const template = Template.fromStack(stack);
  expect(template.toJSON()).toMatchSnapshot();
});
