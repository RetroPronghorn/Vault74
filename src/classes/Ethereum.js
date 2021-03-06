// import Web3 from 'web3';
import { ethers } from 'ethers';
import * as Web3Utils from 'web3-utils';
import config from '@/config/config';
import { getEthereumProviderByNetwork } from '@/utils/EthereumProvider';

export default class Ethereum {
  constructor() {
    this.initialized = false;
    this.utils = ethers.utils;
  }

  /**
   * @description Initializes the provider based on the provider type
   */
  async initialize(providerType, wallet = null, networkRpc = null) {
    this.netConfig = config.network;
    this.providerType = providerType;

    if (this.providerType === 'injected') {
      this.accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });

      this.provider = new ethers.providers.Web3Provider(window.ethereum);

      // If no accounts passed by the constructor, use web3 api to get them
      this.signer = this.provider.getSigner(0);
      // this.accounts = await this.provider.listAccounts();
      [this.activeAccount] = this.accounts;

      // Activate listeners
      this.onAccountChange = window.ethereum.on('accountsChanged', this.handleAccountChange);
      this.onNetworkChange = window.ethereum.on('networkChanged', this.handleNetworkChange);

      this.initialized = true;
    } else if (this.providerType === 'satellite' && wallet) {
      // If no network rpc url is provided, the app will automatically connect to
      // goerli testnet
      if (!networkRpc) {
        this.provider = getEthereumProviderByNetwork(config.network.chain);
      } else {
        this.provider = new ethers.providers.JsonRpcProvider(networkRpc);
      }

      this.wallet = wallet;

      this.signer = wallet.connect(this.provider);

      this.accounts = [this.signer.address];

      this.activeAccount = this.signer.address;

      this.initialized = true;
    } else {
      console.error('Signer is required for satellite provider');
    }
  }

  /**
   * @description Utility function to check if the provider has
   * been initialized
   */
  isInitialized() { return this.isInitialized; }

  /**
   * @description Account change callback
   * @param {string[]} accounts
   */
  handleAccountChange(accounts) {
    this.accounts = accounts;
    this.activeAccount = this.selectedAddress;
  }

  /**
   * @description Network change callback
   * @param {string} networkId
   */
  handleNetworkChange(networkId) {
    this.selectedNetwork = networkId;
  }

  /**
   * @description Retrieve the current block number from the network
   */
  async getBlockNumber() {
    return this.provider.getBlockNumber();
  }

  /**
   * @description Retrieve the network from the network
   */
  async getNetworkType() {
    return this.provider.getNetwork();
  }

  /** @function
   * Check for user specified provider in storage, else use defaults
   * @name fetchProvider
   */
  fetchProvider() {
    return this.netConfig.eth[localStorage.getItem('Satellite.provider')] || this.netConfig.eth.default;
  }

  /** @function
   * Create bindings for web3 methods and utilities
   * @name createBindings
   */
  createBindings() {
    this.eth = this.getEth();
    this.utils = Web3Utils;
  }

  /** @function
   * Send ether to another address
   * @name sendEther
   * @argument to address to send ether to
   * @argument from address to send from (must have access)
   * @argument value amount (in Ether) to send
   * @argument cb callback function to send tx hash to
   */
  sendEther(to, value, cb) {
    const transaction = {
      to,
      value: ethers.utils.parseEther(value),
    };

    this.signer.sendTransaction(transaction).then(tx => cb(tx.hash));
  }

  /** @function
   * Get the ETH package from web3
   * @name getEth
   */
  getEth() {
    return this.web3.eth;
  }

  fromAscii(string) {
    return this.utils.fromAscii(string).padEnd(66, '0');
  }

  /** @function
   * Get the contract constructor
   * @name getContract
   * @argument abi abstract interface for the contract
   * @argument address address of the contract on chain
   */
  getContract(abi, address = null) {
    return new ethers.Contract(address, abi, this.signer);
  }

  getAccount() {
    if (!this.localAccount) {
      const acc = this.eth.accounts.create();
      this.localAccount = {
        address: acc.address,
        nonce: acc.nonce,
        privateKey: acc.privateKey,
      };
      localStorage.setItem('Satellite.eth.account', JSON.stringify(this.localAccount));
    }
    return this.localAccount;
  }

  getAccounts() {
    return this.accounts;
  }

  getActiveAccount() {
    return this.activeAccount;
  }

  signTransaction(tx) {
    return this.eth.accounts.signTransaction(tx, this.localAccount.privateKey);
  }

  executeTransaction(method, account, tx, done) {
    if (this.localAccount) {
      this.signTransaction(method)
        .once('transactionHash', tx)
        .once('confirmation', done);
    } else {
      method
        .send({
          from: account,
          gasLimit: 4700000,
        })
        .once('transactionHash', tx)
        .once('confirmation', done);
    }
  }

  getCurrentAccountBalance() {
    if (this.activeAccount) {
      return this.provider.getBalance(this.activeAccount);
    }
    return null;
  }

  isAddress(text) {
    return this.utils.isAddress(text);
  }
}
