# API Reference for Tokenizer Project

This document serves as a technical reference for developers interacting with the Tokenizer smart contracts. It details the available functions, events, and parameters of each contract in the project.

## Contracts Overview

The Tokenizer project consists of the following main contracts:

1. **MultisigWallet**
2. **Tokenizer**
3. **Treasury**
4. **VRFConsumer**

---

## 1. MultisigWallet

### Functions

- **constructor(address[] memory _owners, uint256 _requiredSignatures)**
  - Initializes the multisig wallet with owners and required signatures.

- **submitTransaction(address to, uint256 value, bytes memory data)**
  - Submits a transaction for approval.

- **approveTransaction(uint256 transactionId)**
  - Approves a submitted transaction.

- **executeTransaction(uint256 transactionId)**
  - Executes a transaction once it has enough approvals.

### Events

- **TransactionSubmitted(uint256 transactionId, address indexed to, uint256 value, bytes data)**
- **TransactionApproved(uint256 indexed transactionId, address indexed owner)**
- **TransactionExecuted(uint256 indexed transactionId)**

---

## 2. Tokenizer

### Functions

- **constructor(uint256 initialSupply, address _vrfConsumer)**
  - Initializes the token with an initial supply and VRF consumer address.

- **mint(address to, uint256 amount)**
  - Mints new tokens to the specified address.

- **burn(address to, uint256 amount)**
  - Burns tokens from the specified address.

- **pause()**
  - Pauses the contract, preventing minting and burning.

- **unpause()**
  - Unpauses the contract, allowing minting and burning.

- **triggerRandomEvent()**
  - Triggers a random event and requests randomness from the VRF consumer.

- **handleRandomness(uint256 requestId)**
  - Handles the randomness response and mints or burns tokens based on the result.

### Events

- **RandomEventTriggered(uint256 requestId, address indexed trigger)**
- **RandomEventResult(uint256 requestId, bool isMinted, uint256 amount)**
- **Received(address sender, uint256 amount)**
- **FallbackCalled(address sender, uint256 amount, bytes data)**

---

## 3. Treasury

### Functions

- **constructor(address _vrfConsumer, address _tokenizer, address[] memory _owners, uint256 _requiredSignatures)**
  - Initializes the Treasury with the multisig owners and the Tokenizer contract address.

- **proposeMint(address to, uint256 amount)**
  - Proposes a mint operation on the Tokenizer contract.

- **proposeBurn(address from, uint256 amount)**
  - Proposes a burn operation on the Tokenizer contract.

- **triggerRandomEvent()**
  - Triggers a random event using the VRF consumer.

- **handleRandomness(uint256 requestId)**
  - Handles the randomness response and mints or burns tokens based on the result.

### Events

- **RandomEventTriggered(uint256 requestId, address indexed trigger)**
- **RandomEventResult(uint256 requestId)**

---

## 4. VRFConsumer

### Functions

- **constructor(address _vrfCoordinator, uint256 _subscriptionId, bytes32 _keyHash)**
  - Initializes the VRF consumer with the VRF coordinator address, subscription ID, and key hash.

- **requestRandomness()**
  - Requests randomness from the Chainlink VRF.

- **fulfillRandomWords(uint256 requestId, uint256[] calldata randomWords)**
  - Callback function to fulfill randomness requests.

- **getRandomness(uint256 requestId)**
  - Retrieves the randomness result for the caller.

- **clearRandomRequest(uint256 requestId)**
  - Clears randomness request data for an address.

### Events

- **RandomnessRequested(uint256 requestId, address requester)**
- **RandomnessFulfilled(uint256 requestId, uint256 randomness)**

---

This API reference provides a comprehensive overview of the functions and events available in the Tokenizer project contracts. For further details on usage, please refer to the usage guide and whitepaper documents.