import { ethers } from "hardhat";
import { expect } from "chai";
import { MultisigWallet } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { ContractFactory } from "ethers";

describe("MultisigWallet", function () {
	let multisigWallet: MultisigWallet;
	let owner1: SignerWithAddress,
		owner2: SignerWithAddress,
		owner3: SignerWithAddress,
		nonOwner: SignerWithAddress;
	const requiredSignatures: number = 2;

	beforeEach(async function () {
		[owner1, owner2, owner3, nonOwner] = await ethers.getSigners();

		const MultisigWallet: ContractFactory = await ethers.getContractFactory("MultisigWallet");
		multisigWallet = (await MultisigWallet.deploy(
			[owner1.address, owner2.address, owner3.address],
			requiredSignatures
		)) as MultisigWallet;
	});

	describe("Deployment", function () {
		it("Should set the correct owners and required signatures", async function () {
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
			await expect(multisigWallet.submitTransaction(owner1.address, 0, "0x"))
				.to.emit(multisigWallet, "TransactionSubmitted")
				.withArgs(0, owner1.address, 0, "0x");
		});

		it("Should allow owners to approve transactions", async function () {
			await multisigWallet.submitTransaction(owner1.address, 0, "0x");
			await expect(multisigWallet.connect(owner1).approveTransaction(0))
				.to.emit(multisigWallet, "TransactionApproved")
				.withArgs(0, owner1.address);
		});

		it("Should not allow non-owners to approve transactions", async function () {
			await multisigWallet.submitTransaction(owner1.address, 0, "0x");
			await expect(
				multisigWallet.connect(nonOwner).approveTransaction(0)
			).to.be.revertedWith("Multisig: caller is not the owner");
		});

		it("Should execute transaction after enough approvals", async function () {
			const tx = await multisigWallet.submitTransaction(owner1.address, 0, "0x");
			await tx.wait();

			await multisigWallet.connect(owner1).approveTransaction(0);
			await multisigWallet.connect(owner2).approveTransaction(0);
			await expect(multisigWallet.connect(owner2).executeTransaction(0))
				.to.emit(multisigWallet, "TransactionExecuted")
				.withArgs(0);
		});

		it("Should not execute transaction before enough approvals", async function () {
			await multisigWallet.submitTransaction(owner1.address, 0, "0x");
			await multisigWallet.connect(owner1).approveTransaction(0);
			await expect(multisigWallet.connect(owner3).executeTransaction(0))
				.to.be.revertedWith("Not enough approvals");
		});

		it("Should not allow duplicate approvals from the same owner", async function () {
			await multisigWallet.submitTransaction(owner1.address, 0, "0x");
			await multisigWallet.connect(owner1).approveTransaction(0);
			await expect(multisigWallet.connect(owner1).approveTransaction(0))
				.to.be.revertedWith("Multisig: transaction already approved");
		});

		it("Should not allow execution of already executed transactions", async function () {
			const tx = await multisigWallet.submitTransaction(owner1.address, 0, "0x");
			await tx.wait();

			await multisigWallet.connect(owner1).approveTransaction(0);
			await multisigWallet.connect(owner2).approveTransaction(0);
			await multisigWallet.connect(owner2).executeTransaction(0);
			await expect(multisigWallet.connect(owner3).executeTransaction(0))
				.to.be.revertedWith("Multisig: transaction already executed");
		});
	});
});