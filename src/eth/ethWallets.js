//
// Wallets Object
// BitGo accessor to a user's wallets.
//
// Copyright 2014, BitGo, Inc.  All Rights Reserved.
//

var bitcoin = require('../bitcoin');
var EthWallet = require('./ethWallet');
var common = require('../common');
var Util = require('../util');
var Q = require('q');
var _ = require('lodash');

//
// Constructor
// TODO: WORK IN PROGRESS
//
var EthWallets = function(bitgo) {
  this.bitgo = bitgo;
};

//
// list
// List the user's wallets
//
EthWallets.prototype.list = function(params, callback) {
  params = params || {};
  common.validateParams(params, [], [], callback);

  var args = [];

  if (params.skip && params.prevId) {
    throw new Error('cannot specify both skip and prevId');
  }

  if (params.limit) {
    if (typeof(params.limit) != 'number') {
      throw new Error('invalid limit argument, expecting number');
    }
    args.push('limit=' + params.limit);
  }
  if (params.getbalances) {
    if (typeof(params.getbalances) != 'boolean') {
      throw new Error('invalid getbalances argument, expecting boolean');
    }
    args.push('getbalances=' + params.getbalances);
  }
  if (params.skip) {
    if (typeof(params.skip) != 'number') {
      throw new Error('invalid skip argument, expecting number');
    }
    args.push('skip=' + params.skip);
  } else if (params.prevId) {
    args.push('prevId=' + params.prevId);
  }

  var query = '';
  if (args.length) {
    query = '?' + args.join('&');
  }

  var self = this;
  return this.bitgo.get(this.bitgo.url('/eth/wallet' + query))
  .result()
  .then(function(body) {
    body.wallets = body.wallets.map(function(w) {
      return new EthWallet(self.bitgo, w);
    });
    return body;
  })
  .nodeify(callback);
};

EthWallets.prototype.getWallet = function(params, callback) {
  params = params || {};
  common.validateParams(params, ['id'], [], callback);

  var self = this;

  var query = '';
  if (params.gpk) {
    query = '?gpk=1';
  }

  return this.bitgo.get(this.bitgo.url('/eth/wallet/' + params.id + query))
  .result()
  .then(function(wallet) {
    return new EthWallet(self.bitgo, wallet);
  })
  .nodeify(callback);
};

//
// generateWallet
// Generate a new 2-of-3 wallet and it's associated keychains.
// Returns the locally created keys with their encrypted xprvs.
// **WARNING: BE SURE TO BACKUP! NOT DOING SO CAN RESULT IN LOSS OF FUNDS!**
//
// 1. Creates the user keychain locally on the client, and encrypts it with the provided passphrase
// 2. If no xpub was provided, creates the backup keychain locally on the client, and encrypts it with the provided passphrase
// 3. Uploads the encrypted user and backup keychains to BitGo
// 4. Creates the BitGo key on the service
// 5. Creates the wallet on BitGo with the 3 public keys above
//
// Parameters include:
//   "passphrase": wallet passphrase to encrypt user and backup keys with
//   "label": wallet label, is shown in BitGo UI
//   "backupAddress": backup ethereum address, it is HIGHLY RECOMMENDED you generate this on a separate machine!
//                 BITGO DOES NOT GUARANTEE SAFETY OF WALLETS WITH MULTIPLE KEYS CREATED ON THE SAME MACHINE **
//   "backupXpubProvider": Provision backup key from this provider (KRS), e.g. "keyternal".
//                         Setting this value will create an instant-capable wallet.
// Returns: {
//   wallet: newly created wallet model object
//   userKeychain: the newly created user keychain, which has an encrypted xprv stored on BitGo
//   backupKeychain: the newly created backup keychain
//
// ** BE SURE TO BACK UP THE ENCRYPTED USER AND BACKUP KEYCHAINS!**
//
// }
EthWallets.prototype.generateWallet = function(params, callback) {
  params = params || {};
  common.validateParams(params, ['passphrase', 'label'], ['backupAddress', 'backupXpub', 'backupXpubProvider', 'enterprise'], callback);
  var self = this;

  if ((!!params.backupAddress + !!params.backupXpub + !!params.backupXpubProvider) > 1) {
    throw new Error("Cannot provide more than one backupAddress or backupXpub or backupXpubProvider flag");
  }

  if (params.disableTransactionNotifications !== undefined && typeof(params.disableTransactionNotifications) != 'boolean') {
    throw new Error('Expected disableTransactionNotifications to be a boolean. ');
  }

  var userKeychain;
  var userAddress;
  var backupKeychain;
  var backupAddress;
  var bitgoAddress;

  // Add the user keychain
  var userKeychainPromise = Q.fcall(function() {
    // Create the user and backup key.
    userKeychain = self.bitgo.keychains().create();
    userKeychain.encryptedXprv = self.bitgo.encrypt({ password: params.passphrase, input: userKeychain.xprv });
    userAddress = Util.xpubToEthAddress(userKeychain.xpub);
    return self.bitgo.keychains().add({
      "xpub": userKeychain.xpub,
      "encryptedXprv": userKeychain.encryptedXprv
    });
  });

  var backupKeychainPromise = Q.fcall(function() {
    if (params.backupXpubProvider) {
      // If requested, use a KRS or backup key provider
      return self.bitgo.keychains().createBackup({
        provider: params.backupXpubProvider,
        disableKRSEmail: params.disableKRSEmail,
        type: 'eth'
      })
      .then(function(keychain) {
        backupKeychain = keychain;
      });
    }

    // User provided backup address
    if (params.backupAddress) {
      backupAddress = params.backupAddress;
      return; // no keychain to store
    }

    // User provided backup xpub
    if (params.backupXpub) {
      // user provided backup ethereum address
      backupKeychain = { 'xpub': params.backupXpub };
    } else {
      // No provided backup xpub or address, so default to creating one here
      backupKeychain = self.bitgo.keychains().create();
    }
    return self.bitgo.keychains().add(backupKeychain);
  })
  .then(function() {
    // the backup keychain may have only been created after the KRS call was completed
    if (backupKeychain) {
      if (backupKeychain.xprv) {
        backupKeychain.encryptedXprv = self.bitgo.encrypt({ password: params.passphrase, input: backupKeychain.xprv });
      }
      backupAddress = Util.xpubToEthAddress(backupKeychain.xpub);
    }
  });

  var bitgoKeychainPromise = self.bitgo.keychains().createBitGo({ type: 'eth' })
  .then(function(keychain) {
    bitgoAddress = keychain.ethAddress;
  });

  // parallelize the independent keychain retrievals/syncs
  return Q.all([userKeychainPromise, backupKeychainPromise, bitgoKeychainPromise])
  .then(function() {
    var walletParams = {
      m: 2,
      n: 3,
      addresses: [
        userAddress,
        backupAddress,
        bitgoAddress
      ],
      label: params.label,
      enterprise: params.enterprise,
      disableTransactionNotifications: params.disableTransactionNotifications
    };
    return self.add(walletParams);
  })
  .then(function(newWallet) {
    var result = {
      wallet: newWallet,
      userKeychain: userKeychain,
      backupKeychain: backupKeychain
    };

    if (backupKeychain && backupKeychain.xprv) {
      result.warning = 'Be sure to back up the backup keychain -- it is not stored anywhere else!';
    }

    return result;
  })
  .nodeify(callback);
};

//
// add
// Add a new EthWallet (advanced mode).
// This allows you to manually submit the keychains, type, m and n of the wallet
// Parameters include:
//    "label": label of the wallet to be shown in UI
//    "m": number of keys required to unlock wallet (2)
//    "n": number of keys available on the wallet (3)
//    "keychains": array of keychain xpubs
EthWallets.prototype.add = function(params, callback) {
  params = params || {};
  common.validateParams(params, [], ['label', 'enterprise'], callback);

  if (Array.isArray(params.addresses) === false || typeof(params.m) !== 'number' ||
  typeof(params.n) != 'number') {
    throw new Error('invalid argument');
  }

  if (params.m != 2 || params.n != 3) {
    throw new Error('unsupported multi-sig type');
  }

  var self = this;
  var walletParams = _.extend({ type: 'eth' }, params);

  return this.bitgo.post(this.bitgo.url('/eth/wallet'))
  .send(walletParams)
  .result()
  .then(function(body) {
    var serverAddresses = _.map(body.private.addresses, 'address');
    if (!_.isEqual(walletParams.addresses, serverAddresses)) {
      throw new Error('server addresses do not match');
    }
    return new EthWallet(self.bitgo, body);
  })
  .nodeify(callback);
};

//
// get
// Shorthand to getWallet
// Parameters include:
//   id: the id of the wallet
//
EthWallets.prototype.get = function(params, callback) {
  return this.getWallet(params, callback);
};

//
// remove
// Remove an existing wallet.
// Parameters include:
//   id: the id of the wallet
//
EthWallets.prototype.remove = function(params, callback) {
  params = params || {};
  common.validateParams(params, ['id'], [], callback);

  var self = this;
  return this.bitgo.del(this.bitgo.url('/eth/wallet/' + params.id))
  .result()
  .nodeify(callback);
};

module.exports = EthWallets;
