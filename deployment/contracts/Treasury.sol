// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

import "./MultisigWallet.sol";
import "./Tokenizer.sol";

contract Treasury is MultisigWallet {

	IVRFConsumer public	vrfConsumer;
	Tokenizer public tokenizer;

	mapping(uint256 => address)	requestIdToAddress;

	event RandomEventTriggered(uint256 requestId, address indexed trigger);
	event RandomEventResult(uint256 requestId);

	/**
	 * @notice Initializes the Treasury with the multisig owners, required signatures,
	 *         and the address of the Tokenizer contract.
	 * @param _tokenizer The address of the deployed Tokenizer contract.
	 * @param _owners Array of addresses that will own the multisig wallet.
	 * @param _requiredSignatures The number of approvals required to execute a transaction.
	 */
	constructor(
		address _vrfConsumer,
		address _tokenizer,
		address[] memory _owners,
		uint256 _requiredSignatures
	) MultisigWallet(_owners, _requiredSignatures) {
		vrfConsumer = IVRFConsumer(_vrfConsumer);
		tokenizer = Tokenizer(payable(_tokenizer));
	}

	/**
	 * @notice Proposes a mint operation on the Tokenizer contract.
	 * @param to The address to receive the minted tokens.
	 * @param amount The amount of tokens to mint.
	 * 
	 * Requirements:
	 * - The Treasury multisig must have the MINTER_ROLE in the Tokenizer contract.
	 */
	function proposeMint(address to, uint256 amount) external onlyOwner {
		bytes memory data = abi.encodeWithSignature("mint(address,uint256)", to, amount);
		submitTransaction(address(tokenizer), 0, data);
	}

	/**
	 * @notice Proposes a burn operation on the Tokenizer contract.
	 * @param from The address from which tokens will be burned.
	 * @param amount The amount of tokens to burn.
	 * 
	 * Requirements:
	 * - The Treasury multisig must have the BURNER_ROLE in the Tokenizer contract.
	 */
	function proposeBurn(address from, uint256 amount) external onlyOwner {
		bytes memory data = abi.encodeWithSignature("burn(address,uint256)", from, amount);
		submitTransaction(address(tokenizer), 0, data);
	}

	/**
	 * @notice Triggers a random event if the required time interval has passed since the last event.
	 * @dev Requests random words from the VRF consumer and stores the request ID with the caller's address.
	 * @return requestId The ID of the random words request.
	 */
	function triggerRandomEvent() external returns (uint256 requestId) {
		requestId = vrfConsumer.requestRandomness();
		requestIdToAddress[requestId] = msg.sender;
		emit RandomEventTriggered(requestId, msg.sender);
	}

	/**
	 * @notice Handles the randomness response from the VRF consumer
	 * @dev Mints or burns tokens based on the randomness result
	 * @param requestId The ID of the randomness request
	 */
	function handleRandomness(uint256 requestId) external onlyOwner {
		require(msg.sender == requestIdToAddress[requestId], "Caller is not the requester");
		uint256 randomness = vrfConsumer.getRandomness(requestId);
		require(randomness != 0, "Randomness not available");

		address requester = requestIdToAddress[requestId];
		bool shouldMint = (randomness % 2) == 0;
		uint256 percentage = (randomness % 5) + 1;
		uint256 amount = (tokenizer.totalSupply() * percentage) / 100;

		if (shouldMint) {
			tokenizer.mint(requester, amount);
		} else {
			amount = tokenizer.balanceOf(requester) < amount ? tokenizer.balanceOf(requester) : amount;
			tokenizer.burn(requester, amount);
		}

		emit RandomEventResult(requestId);
		delete requestIdToAddress[requestId];
	}
}