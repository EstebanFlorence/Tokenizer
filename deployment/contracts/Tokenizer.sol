// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Tokenizer is ERC20, Ownable
{

	constructor(uint256 initialSupply) ERC20("Tokenizer", "TOK") Ownable(_msgSender())
	{
		_mint(_msgSender(), initialSupply);
	}

	function mint(address to, uint256 amount) external onlyOwner
	{
		_mint(to, amount);
	}

}