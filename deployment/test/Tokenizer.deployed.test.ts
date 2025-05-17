import { ethers } from "hardhat";
import { expect } from "chai";
import {
	Tokenizer__factory, Tokenizer,
	VRFConsumer__factory, VRFConsumer,
	VRFCoordinatorV2_5Mock__factory, VRFCoordinatorV2_5Mock,
	Treasury__factory, Treasury
} from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { Log, LogDescription } from "ethers";

describe("Tokenizer (Using Deployed Contract)", function () {
	let tokenizer: Tokenizer;
	let vrfConsumer: VRFConsumer;
	let mockVRFCoordinator: VRFCoordinatorV2_5Mock;
	let treasury: Treasury;
	let owner: SignerWithAddress,
		owner2: SignerWithAddress,
		owner3: SignerWithAddress,
		user1: SignerWithAddress;
	const tokenizerAddress: string = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";
	const treasuryAddress: string = "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707";
	const vrfConsumerAddress: string = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";

	before(async function () {

		[owner, owner2, owner3, user1] = await ethers.getSigners();

		// Get contract instances
		tokenizer = Tokenizer__factory.connect(tokenizerAddress, owner);
		vrfConsumer = VRFConsumer__factory.connect(vrfConsumerAddress, owner);

		const vrfCoordinatorAddress = await vrfConsumer.s_vrfCoordinator();
		mockVRFCoordinator = VRFCoordinatorV2_5Mock__factory.connect(vrfCoordinatorAddress, owner);

		treasury = Treasury__factory.connect(treasuryAddress, owner);

		// Create VRF Subscription
		const tx = await mockVRFCoordinator.createSubscription();
		const receipt = await tx.wait();

		if (!receipt) {
			throw new Error("Transaction receipt is null");
		}

		// Fetch the transaction ID from the emitted event
		const event = receipt?.logs
			.map((log: Log) => mockVRFCoordinator.interface.parseLog(log))
			.find((parsedLog: LogDescription | null) => parsedLog?.name === "SubscriptionCreated");

		if (!event) {
			throw new Error("SubscriptionCreated event not found in receipt logs");
		}

		const subscriptionId = event?.args[0];

		// Fund the subscription
		try {
			await mockVRFCoordinator.fundSubscription(subscriptionId, ethers.parseEther("7"));
			console.log("Funded VRF subscription");
		} catch (error) {
			if (error instanceof Error) {
				console.log("Subscription might already be funded:", error.message);
			} else {
				console.log("Subscription might already be funded:", error);
			}
		}

		// Add consumer to VRF
		try {
			await mockVRFCoordinator.addConsumer(subscriptionId, vrfConsumerAddress);
			await mockVRFCoordinator.addConsumer(subscriptionId, vrfConsumerAddress);
			console.log("Added consumer to VRF subscription");
		} catch (error) {
			if (error instanceof Error) {
				console.log("Subscription might already be funded:", error.message);
			} else {
				console.log("Subscription might already be funded:", error);
			}
		}
	});

	describe("Deployment", function () {
		it("Should connect to deployed contract", async function () {
			expect(await tokenizer.hasRole(await tokenizer.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
		});
	});

	describe("Pausing", function () {
		it("Should allow owner to pause and unpause the contract", async function () {
			await tokenizer.connect(owner).pause();
			expect(await tokenizer.paused()).to.be.true;
			await tokenizer.connect(owner).unpause();
			expect(await tokenizer.paused()).to.be.false;
		});

		it("Should not allow non-owner to pause or unpause the contract", async function () {
			await expect(tokenizer.connect(owner2).pause())
			.to.be.revertedWithCustomError(tokenizer, "AccessControlUnauthorizedAccount")
			.withArgs(owner2.address, await tokenizer.PAUSER_ROLE());
			await expect(tokenizer.connect(owner2).pause())
			.to.be.revertedWithCustomError(tokenizer, "AccessControlUnauthorizedAccount")
			.withArgs(owner2.address, await tokenizer.PAUSER_ROLE());
		});

		it("Should not allow minting when paused", async function () {
			const mintAmount = ethers.parseEther("100");
			await tokenizer.pause();
			await tokenizer.grantRole((await tokenizer.MINTER_ROLE()), owner.address);
			await expect(tokenizer.mint(owner2.address, mintAmount))
				.to.be.revertedWithCustomError(tokenizer, "EnforcedPause");
			await tokenizer.unpause();
		});

		it("Should allow minting when unpaused", async function () {
			await tokenizer.pause();
			await tokenizer.unpause();
			const mintAmount = ethers.parseEther("100");
			const initialBalance = await tokenizer.balanceOf(owner2.address);
			await tokenizer.mint(owner2.address, mintAmount);
			const expectedBalance = initialBalance + mintAmount;
			expect(await tokenizer.balanceOf(owner2.address)).to.equal(expectedBalance);
		});
	});

	describe("Treasury", function () {
		it("Should allow Treasury to mint tokens", async function () {
			const mintAmount = ethers.parseEther("100");
			const initialBalance = await tokenizer.balanceOf(owner2.address);
			const expectedBalance = initialBalance + mintAmount;

			// Propose mint transaction
			const tx = await treasury.proposeMint(owner2.address, mintAmount);
			const receipt = await tx.wait();

			if (!receipt) {
				throw new Error("Transaction receipt is null");
			}

			// Fetch the transaction ID from the emitted event
			const event = receipt?.logs
				.map((log: Log) => treasury.interface.parseLog(log))
				.find((parsedLog: LogDescription | null) => parsedLog?.name === "TransactionSubmitted");

			if (!event) {
				throw new Error("TransactionSubmitted event not found in receipt logs");
			}

			const txId = event?.args[0];

			// Execute mint transaction
			await treasury.approveTransaction(txId);
			await treasury.connect(owner2).approveTransaction(txId);
			await treasury.executeTransaction(txId);

			// Verify balance
			expect(await tokenizer.balanceOf(owner2.address)).to.equal(expectedBalance);
		});

		it("Should allow Treasury to burn tokens", async function () {
			const burnAmount = ethers.parseEther("50");
			const initialBalance = await tokenizer.balanceOf(owner2.address);
			const expectedBalance = initialBalance - burnAmount;

			// Propose burn transaction
			const tx = await treasury.proposeBurn(owner2.address, burnAmount);
			const receipt = await tx.wait();

			if (!receipt) {
				throw new Error("Transaction receipt is null");
			}

			// Fetch the transaction ID from the emitted event
			const event = receipt?.logs
				.map((log: Log) => treasury.interface.parseLog(log))
				.find((parsedLog: LogDescription | null) => parsedLog?.name === "TransactionSubmitted");

			if (!event) {
				throw new Error("TransactionSubmitted event not found in receipt logs");
			}

			const txId = event?.args[0];

			// Execute burn transaction
			await treasury.approveTransaction(txId);
			await treasury.connect(owner2).approveTransaction(txId);
			await treasury.executeTransaction(txId);

			// Verify balance
			expect(await tokenizer.balanceOf(owner2.address)).to.equal(expectedBalance);
		});

		it("Should not allow unauthorized accounts to mint tokens", async function () {
			const mintAmount = ethers.parseEther("100");

			// Attempt to propose mint from unauthorized account
			await expect(
				treasury.connect(user1).proposeMint(user1.address, mintAmount)
			).to.be.revertedWith("Multisig: caller is not the owner");
		});

		it("Should not allow unauthorized accounts to burn tokens", async function () {
			const mintAmount = ethers.parseEther("100");

			// Attempt to propose mint from unauthorized account
			await expect(
				treasury.connect(user1).proposeBurn(user1.address, mintAmount)
			).to.be.revertedWith("Multisig: caller is not the owner");
		});
	});

});
