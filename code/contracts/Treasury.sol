// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

import "./MultisigWallet.sol";
import "./Tokenizer.sol";

contract Treasury is MultisigWallet {

	IVRFConsumer public	vrfConsumer;
	Tokenizer public tokenizer;

	mapping(uint256 => address)	requestIdToAddress;

	event RandomEventTriggered(uint256 requestId, address trigger);
	event RandomEventResult(uint256 randomness);

	constructor(
		address _vrfConsumer,
		address _tokenizer,
		address[] memory _owners,
		uint256 _requiredSignatures
	) MultisigWallet(_owners, _requiredSignatures) {
		vrfConsumer = IVRFConsumer(_vrfConsumer);
		tokenizer = Tokenizer(payable(_tokenizer));
	}

	function proposeMint(address to, uint256 amount) external onlyOwner {
		bytes memory data = abi.encodeWithSignature("mint(address,uint256)", to, amount);
		submitTransaction(address(tokenizer), 0, data);
	}

	function proposeBurn(address from, uint256 amount) external onlyOwner {
		bytes memory data = abi.encodeWithSignature("burn(address,uint256)", from, amount);
		submitTransaction(address(tokenizer), 0, data);
	}

	function triggerRandomEvent() external returns (uint256 requestId) {
		requestId = vrfConsumer.requestRandomness();
		requestIdToAddress[requestId] = msg.sender;
		emit RandomEventTriggered(requestId, msg.sender);
	}

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

		emit RandomEventResult(randomness);
		delete requestIdToAddress[requestId];
	}
}