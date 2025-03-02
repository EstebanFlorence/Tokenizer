const { ethers } = require("hardhat");
const { expect } = require("chai");

describe("MultisigWallet (Using Deployed Contract)", function () {
	let multisigWallet;
	let owner1;
	let owner2;
	let owner3;
	let nonOwner;
	const multisigWalletAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

	before(async function () {
		[owner1, owner2, owner3, nonOwner] = await ethers.getSigners();

		multisigWallet = await ethers.getContractAt("MultisigWallet", multisigWalletAddress);
	});

	describe("Deployment", function () {
		it("Should connect to deployed contract", async function () {
			expect(await multisigWallet.owners(0)).to.equal(owner1.address);
			expect(await multisigWallet.owners(1)).to.equal(owner2.address);
			expect(await multisigWallet.owners(2)).to.equal(owner3.address);
			expect(await multisigWallet.requiredSignatures()).to.equal(2);
		});

		it("Should not allow non-owners to submit transactions", async function () {
			await expect(
				multisigWallet.connect(nonOwner).submitTransaction(owner1.address, 0, "0x")
			).to.be.revertedWith("Not an owner");
		});
	});

	describe("Transactions", function () {
		it("Should allow owners to submit transactions", async function () {
			await expect(multisigWallet.submitTransaction(owner1.address, 0, "0x"))
				.to.emit(multisigWallet, "TransactionSubmitted")
				.withArgs(0, owner1.address, 0, "0x");
		});

		it("Should allow owners to approve transactions", async function () {
			await multisigWallet.submitTransaction(owner1.address, 0, "0x");
			await expect(multisigWallet.connect(owner1).approveTransaction(1))
				.to.emit(multisigWallet, "TransactionApproved")
				.withArgs(1, owner1.address);
		});

		it("Should not allow non-owners to approve transactions", async function () {
			await multisigWallet.submitTransaction(owner1.address, 0, "0x");
			await expect(
				multisigWallet.connect(nonOwner).approveTransaction(2)
			).to.be.revertedWith("Not an owner");
		});

		it("Should execute transaction after enough approvals", async function () {
			const tx = await multisigWallet.submitTransaction(owner1.address, 0, "0x");
			await tx.wait();

			await multisigWallet.connect(owner1).approveTransaction(3);
			await multisigWallet.connect(owner2).approveTransaction(3);
			await expect(multisigWallet.connect(owner2).executeTransaction(3))
				.to.emit(multisigWallet, "TransactionExecuted")
				.withArgs(3);
		});

		it("Should not execute transaction before enough approvals", async function () {
			await multisigWallet.submitTransaction(owner1.address, 0, "0x");
			await multisigWallet.connect(owner1).approveTransaction(4);
			await expect(multisigWallet.connect(owner3).executeTransaction(4))
				.to.be.revertedWith("Not enough approvals");
		});

		it("Should not allow duplicate approvals from the same owner", async function () {
			await multisigWallet.submitTransaction(owner1.address, 0, "0x");
			await multisigWallet.connect(owner1).approveTransaction(5);
			await expect(multisigWallet.connect(owner1).approveTransaction(5))
				.to.be.revertedWith("Transaction already approved");
		});

		it("Should not allow execution of already executed transactions", async function () {
			const tx = await multisigWallet.submitTransaction(owner1.address, 0, "0x");
			await tx.wait();

			await multisigWallet.connect(owner1).approveTransaction(6);
			await multisigWallet.connect(owner2).approveTransaction(6);
			await multisigWallet.connect(owner2).executeTransaction(6);
			await expect(multisigWallet.connect(owner3).executeTransaction(6))
				.to.be.revertedWith("Transaction already executed");
		});
	});
});