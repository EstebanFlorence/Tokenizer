// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

contract MultisigWallet
{
	address[] public owners;
	uint256 public requiredSignatures;
	mapping(address => bool) public isOwner;
	mapping(uint256 => Transaction) public transactions;
	mapping(uint256 => mapping(address => bool)) public approvals;
	uint256 public transactionCount;

	/**
	 * @dev Struct to represent a transaction within the MultisigWallet contract.
	 * 
	 * @param to The address of the recipient to whom the transaction is intended.
	 * @param value The amount of Ether (in wei) to be transferred in the transaction.
	 * @param data The data payload of the transaction, used to encode function calls or other data.
	 * @param executed A boolean indicating whether the transaction has been executed or not.
	 */
	struct Transaction
	{
		address to;
		uint256 value;
		bytes data;
		bool executed;
	}

	event TransactionSubmitted(uint256 indexed transactionId, address indexed to, uint256 value, bytes data);
	event TransactionApproved(uint256 indexed transactionId, address indexed owner);
	event TransactionExecuted(uint256 indexed transactionId);

	modifier onlyOwner()
	{
		require(isOwner[msg.sender], "Not an owner");
		_;
	}

	modifier transactionExists(uint256 transactionId)
	{
		require(transactions[transactionId].to != address(0), "Transaction does not exist");
		_;
	}

	modifier notApproved(uint256 transactionId)
	{
		require(!approvals[transactionId][msg.sender], "Transaction already approved");
		_;
	}

	modifier notExecuted(uint256 transactionId)
	{
		require(!transactions[transactionId].executed, "Transaction already executed");
		_;
	}

	constructor(address[] memory _owners, uint256 _requiredSignatures)
	{
		require(_owners.length > 0, "Owners required");
		require(_requiredSignatures > 0 && _requiredSignatures <= _owners.length, "Invalid number of required signatures");

		for (uint256 i = 0; i < _owners.length; i++)
		{
			address owner = _owners[i];
			require(owner != address(0), "Invalid owner");
			require(!isOwner[owner], "Owner not unique");

			isOwner[owner] = true;
			owners.push(owner);
		}

		requiredSignatures = _requiredSignatures;
	}

	function submitTransaction(address to, uint256 value, bytes memory data) public onlyOwner
	{
		uint256 transactionId = transactionCount;
		transactions[transactionId] = Transaction({
			to: to,
			value: value,
			data: data,
			executed: false
		});
		transactionCount++;

		emit TransactionSubmitted(transactionId, to, value, data);
	}

	function approveTransaction(uint256 transactionId) public onlyOwner transactionExists(transactionId) notApproved(transactionId)
	{
		approvals[transactionId][msg.sender] = true;

		emit TransactionApproved(transactionId, msg.sender);
	}

	function executeTransaction(uint256 transactionId) public onlyOwner transactionExists(transactionId) notExecuted(transactionId)
	{
		Transaction storage transaction = transactions[transactionId];

		uint256 approvalCount = 0;
		for (uint256 i = 0; i < owners.length; i++)
		{
			if (approvals[transactionId][owners[i]])
			{
				approvalCount++;
			}
		}

		require(approvalCount >= requiredSignatures, "Not enough approvals");

		transaction.executed = true;
		(bool success, ) = transaction.to.call{value: transaction.value}(transaction.data);

		require(success, "Transaction failed");

		emit TransactionExecuted(transactionId);
	}

	receive() external payable {}
}