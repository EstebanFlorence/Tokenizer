// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IVRFConsumer {
	function requestRandomness() external returns (uint256 requestId);
	function getRandomness(uint256 requestId) external view returns (uint256);
}

contract BiscaTreasury is ERC20, Ownable
{
	// Chainlink VRF 
	IVRFConsumer public	vrfConsumer;

	// Mapping which address triggered which request
	mapping(uint256 => address)	requestIdToAddress;

	// Events
	event RandomEventTriggered(uint256 requestId, address indexed trigger);
	event RandomEventResult(uint256 requestId);

	constructor(
		uint256 initialSupply,
		address _vrfConsumer
	)
	ERC20("Lalleri", "42")
	{
		vrfConsumer = IVRFConsumer(_vrfConsumer);
		_mint(_msgSender(), initialSupply);
	}

	function mint(address to, uint256 amount) external onlyOwner
	{
		_mint(to, amount);
	}

	function burn(address to, uint256 amount) external onlyOwner
	{
		_burn(to, amount);
	}

}