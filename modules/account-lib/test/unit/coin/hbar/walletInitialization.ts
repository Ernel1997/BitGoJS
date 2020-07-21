import should from 'should';
import { register } from '../../../../src/index';
import { TransactionBuilderFactory } from '../../../../src/coin/hbar';
import * as testData from '../../../resources/hbar/hbar';

describe('Wallet initialization', () => {
  const factory = register('thbar', TransactionBuilderFactory);

  const initTxBuilder = () => {
    const txBuilder = factory.getWalletInitializationBuilder();
    txBuilder.fee({ fee: '1000000000' });
    txBuilder.owner(testData.OWNER1);
    txBuilder.owner(testData.OWNER2);
    txBuilder.owner(testData.OWNER3);
    txBuilder.source({ address: testData.ACCOUNT1 });
    return txBuilder;
  };

  describe('should build ', () => {
    it('a valid raw tx for wallet init', async () => {
      const builder = initTxBuilder();
      const tx = await builder.build();
      const raw = tx.toBroadcastFormat();
      const builder2 = factory.getWalletInitializationBuilder();
      builder2.from(raw);
      const tx2 = await builder2.build();
      should.deepEqual(tx.toJson(), tx2.toJson());
      should.deepEqual(raw, tx2.toBroadcastFormat());
    });

    it('an init transaction', async () => {
      const txBuilder = initTxBuilder();
      const tx = await txBuilder.build();
      const txJson = tx.toJson();
      txJson.fee.should.equal(1000000000);
      should.equal(txJson.from, testData.ACCOUNT1);
    });

    it.skip('a signed init transaction from serialized', async () => {
      const txBuilder = initTxBuilder();
      // TODO sign
      const tx = await txBuilder.build();
      const newTxBuilder = factory.getWalletInitializationBuilder();
      newTxBuilder.from(tx.toBroadcastFormat());
      const newTx = await newTxBuilder.build();
      should.equal(newTx.toBroadcastFormat(), tx.toBroadcastFormat());
    });
  });

  describe('should fail to build', () => {
    it('a transaction without fee', async () => {
      const txBuilder = factory.getWalletInitializationBuilder();
      txBuilder.owner(testData.OWNER1);
      txBuilder.owner(testData.OWNER2);
      txBuilder.owner(testData.OWNER3);
      txBuilder.source({ address: testData.ACCOUNT1 });
      // TODO sign
      await txBuilder.build().should.be.rejectedWith('Invalid transaction: missing fee');
    });

    it('a wallet initialization the wrong number of owners', async () => {
      const txBuilder = factory.getWalletInitializationBuilder();
      txBuilder.fee({ fee: '1000000000' });
      txBuilder.owner(testData.OWNER1);
      txBuilder.owner(testData.OWNER2);
      txBuilder.source({ address: testData.ACCOUNT1 });
      await txBuilder
        .build()
        .should.be.rejectedWith('Invalid transaction: wrong number of owners -- required: 3, found: 2');

      should.throws(() => txBuilder.owner(testData.OWNER1), 'Repeated owner address: ' + testData.OWNER1);

      const newTxBuilder = factory.getWalletInitializationBuilder();
      newTxBuilder.fee({ fee: '1000000000' });
      newTxBuilder.source({ address: testData.ACCOUNT1 });
      await newTxBuilder
        .build()
        .should.be.rejectedWith('Invalid transaction: wrong number of owners -- required: 3, found: 0');
    });

    it('a transaction with invalid source', async () => {
      const factory = register('thbar', TransactionBuilderFactory);
      const txBuilder = factory.getWalletInitializationBuilder();
      txBuilder.fee({ fee: '1000000000' });
      txBuilder.owner(testData.OWNER1);
      txBuilder.owner(testData.OWNER2);
      txBuilder.owner(testData.OWNER3);
      await txBuilder.build().should.be.rejectedWith('Invalid transaction: missing source');
    });
  });

  describe('should validate', () => {
    it('an address', async () => {
      const txBuilder = factory.getWalletInitializationBuilder();
      txBuilder.validateAddress(testData.VALID_ADDRESS);
      should.throws(
        () => txBuilder.validateAddress(testData.INVALID_ADDRESS),
        'Invalid address ' + testData.INVALID_ADDRESS,
      );
    });

    it('value should be greater than zero', () => {
      const txBuilder = factory.getWalletInitializationBuilder();
      should.throws(() => txBuilder.fee({ fee: '-10' }));
      should.doesNotThrow(() => txBuilder.fee({ fee: '10' }));
    });

    it.skip('a private key', () => {
      const txBuilder = factory.getWalletInitializationBuilder();
      should.throws(() => txBuilder.validateKey({ key: 'abc' }), 'Invalid key');
      should.doesNotThrow(() => txBuilder.validateKey({ key: testData.PRIVATE_KEY }));
    });

    it('a raw transaction', async () => {
      const txBuilder = factory.getWalletInitializationBuilder();
      // should.doesNotThrow(() => txBuilder.from(testData.TX_BROADCAST));
      should.doesNotThrow(() => txBuilder.validateRawTransaction(testData.sourcePrv));
      should.throws(() => txBuilder.validateRawTransaction('0x00001000'));
      should.throws(() => txBuilder.validateRawTransaction(''));
      should.throws(() => txBuilder.validateRawTransaction('pqrs'));
      should.throws(() => txBuilder.validateRawTransaction(1234));
    });

    it('a transaction to build', async () => {
      const txBuilder = factory.getWalletInitializationBuilder();
      should.throws(() => txBuilder.validateTransaction(), 'Invalid transaction: missing fee');
      txBuilder.fee({ fee: '10' });
      should.throws(() => txBuilder.validateTransaction(), 'Invalid transaction: missing source');
      txBuilder.source(testData.VALID_ADDRESS);
      should.throws(() => txBuilder.validateTransaction(), 'wrong number of owners -- required: 3, found: 0');
      txBuilder.owner(testData.OWNER1);
      should.throws(() => txBuilder.validateTransaction(), 'wrong number of owners -- required: 3, found: 1');
      txBuilder.owner(testData.OWNER2);
      should.throws(() => txBuilder.validateTransaction(), 'wrong number of owners -- required: 3, found: 2');
      txBuilder.owner(testData.OWNER3);
      should.doesNotThrow(() => txBuilder.validateTransaction());
    });
  });
});
