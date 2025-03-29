const { ethers } = require("hardhat");
const { expect } = require("chai");

describe("MultisigWallet (Using Deployed Contract)", function () {
	let multisigWallet;
	let owner1, owner2, owner3, nonOwner;
	const requiredSignatures = 2;
	const multisigWalletAddress = "0x5fc8d32690cc91d4c39d9d3abcbd16989f875707";

	before(async function () {
		[owner1, owner2, owner3, nonOwner] = await ethers.getSigners();

		multisigWallet = await ethers.getContractAt("MultisigWallet", multisigWalletAddress);
	});

	describe("Deployment", function () {
		it("Should connect to deployed contract", async function () {
			expect(await multisigWallet.owners(0)).to.equal(owner1.address);
			expect(await multisigWallet.owners(1)).to.equal(owner2.address);
			expect(await multisigWallet.owners(2)).to.equal(owner3.address);
			expect(await multisigWallet.requiredSignatures()).to.equal(requiredSignatures);
		});

		it("Should not allow non-owners to submit transactions", async function () {
			await expect(
				multisigWallet.connect(nonOwner).submitTransaction(owner1.address, 0, "0x")
			).to.be.revertedWith("Multisig: caller is not the owner");
		});
	});

	describe("Transactions", function () {
		it("Should allow owners to submit transactions", async function () {
			const proposeTx = await multisigWallet.submitTransaction(owner1.address, 0, "0x");
			const proposeReceipt = await proposeTx.wait();

			const event = proposeReceipt.logs.find(
				log => log.fragment && log.fragment.name === "TransactionSubmitted"
			).args;
			const txId = event[0];

			await expect(proposeTx)
				.to.emit(multisigWallet, "TransactionSubmitted")
				.withArgs(txId, owner1.address, 0, "0x");
		});

		it("Should allow owners to approve transactions", async function () {
			const proposeTx = await multisigWallet.submitTransaction(owner1.address, 0, "0x");
			const proposeReceipt = await proposeTx.wait();

			const event = proposeReceipt.logs.find(
				log => log.fragment && log.fragment.name === "TransactionSubmitted"
			).args;
			const txId = event[0];

			await expect(multisigWallet.connect(owner1).approveTransaction(txId))
				.to.emit(multisigWallet, "TransactionApproved")
				.withArgs(txId, owner1.address);
		});

		it("Should not allow non-owners to approve transactions", async function () {
			const proposeTx = await multisigWallet.submitTransaction(owner1.address, 0, "0x");
			const proposeReceipt = await proposeTx.wait();

			const event = proposeReceipt.logs.find(
				log => log.fragment && log.fragment.name === "TransactionSubmitted"
			).args;
			const txId = event[0];

			await expect(
				multisigWallet.connect(nonOwner).approveTransaction(txId)
			).to.be.revertedWith("Multisig: caller is not the owner");
		});

		it("Should execute transaction after enough approvals", async function () {
			const proposeTx = await multisigWallet.submitTransaction(owner1.address, 0, "0x");
			const proposeReceipt = await proposeTx.wait();

			const event = proposeReceipt.logs.find(
				log => log.fragment && log.fragment.name === "TransactionSubmitted"
			).args;
			const txId = event[0];

			await multisigWallet.connect(owner1).approveTransaction(txId);
			await multisigWallet.connect(owner2).approveTransaction(txId);
			await expect(multisigWallet.connect(owner2).executeTransaction(txId))
				.to.emit(multisigWallet, "TransactionExecuted")
				.withArgs(txId);
		});

		it("Should not execute transaction before enough approvals", async function () {
			const proposeTx = await multisigWallet.submitTransaction(owner1.address, 0, "0x");
			const proposeReceipt = await proposeTx.wait();

			const event = proposeReceipt.logs.find(
				log => log.fragment && log.fragment.name === "TransactionSubmitted"
			).args;
			const txId = event[0];

			await multisigWallet.connect(owner1).approveTransaction(txId);
			await expect(multisigWallet.connect(owner3).executeTransaction(txId))
				.to.be.revertedWith("Not enough approvals");
		});

		it("Should not allow duplicate approvals from the same owner", async function () {
			const proposeTx = await multisigWallet.submitTransaction(owner1.address, 0, "0x");
			const proposeReceipt = await proposeTx.wait();

			const event = proposeReceipt.logs.find(
				log => log.fragment && log.fragment.name === "TransactionSubmitted"
			).args;
			const txId = event[0];

			await multisigWallet.connect(owner1).approveTransaction(txId);
			await expect(multisigWallet.connect(owner1).approveTransaction(txId))
				.to.be.revertedWith("Multisig: transaction already approved");
		});

		it("Should not allow execution of already executed transactions", async function () {
			const proposeTx = await multisigWallet.submitTransaction(owner1.address, 0, "0x");
			const proposeReceipt = await proposeTx.wait();

			const event = proposeReceipt.logs.find(
				log => log.fragment && log.fragment.name === "TransactionSubmitted"
			).args;
			const txId = event[0];

			await multisigWallet.connect(owner1).approveTransaction(txId);
			await multisigWallet.connect(owner2).approveTransaction(txId);
			await multisigWallet.connect(owner2).executeTransaction(txId);
			await expect(multisigWallet.connect(owner3).executeTransaction(txId))
				.to.be.revertedWith("Multisig: transaction already executed");
		});
	});
});