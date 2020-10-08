import should from 'should';
import { register } from '../../../../../src/index';
import { TransactionBuilderFactory } from '../../../../../src/coin/trx';
// import * as testData from '../../../../resources/trx/trx';
// import { Transaction } from '../../../../../src/coin/trx/transaction';
// import { TransactionType } from '../../../../../src/coin/baseCoin';

describe('HBAR Transfer Builder', () => {
  const factory = register('trx', TransactionBuilderFactory);

  // TTsGwnTLQ4eryFJpDvJSfuGQxPXRCjXvZz
  // 41e5e00fc1cdb3921b8340c20b2b65b543c84aa1dd
  // 412c2ba4a9ff6c53207dc5b686bfecf75ea7b80577

  const initTxBuilder = () => {
    const txBuilder = factory.getTransferBuilder();
    txBuilder.source({ address: 'TTsGwnTLQ4eryFJpDvJSfuGQxPXRCjXvZz' });
    txBuilder.to({ address: 'TDzm1tCXM2YS1PDa3GoXSvxdy4AgwVbBPE' });
    txBuilder.amount('10');
    return txBuilder;
  };

  describe('should build ', () => {
    describe('non serialized transactions', () => {
      it.only('a signed transfer transaction 111111111111111111111111111111111111', async () => {
        const builder = initTxBuilder();
        builder.sign({ key: '2DBEAC1C22849F47514445A56AEF2EF164528A502DE4BD289E23EA1E2D4C4B06' });
        const tx = await builder.build();
        console.log(tx);
        // const txJson = tx.toJson();

        // console.log(txJson);

        // should.deepEqual(tx.signature.length, 1);
        // should.deepEqual(txJson.to, testData.ACCOUNT_2.accountId);
        // should.deepEqual(txJson.amount, '10');
        // should.deepEqual(txJson.from, testData.ACCOUNT_1.accountId);
        // should.deepEqual(txJson.fee.toString(), testData.FEE);
        // should.deepEqual(tx.toBroadcastFormat(), testData.SIGNED_TRANSFER_TRANSACTION);
        // tx.type.should.equal(TransactionType.Send);

        // tx.outputs.length.should.equal(1);
        // tx.outputs[0].address.should.equal(testData.ACCOUNT_2.accountId);
        // tx.outputs[0].value.should.equal('10');
        // tx.inputs.length.should.equal(1);
        // tx.inputs[0].address.should.equal(testData.ACCOUNT_1.accountId);
        // tx.inputs[0].value.should.equal('10');
      });
    });
  });
});