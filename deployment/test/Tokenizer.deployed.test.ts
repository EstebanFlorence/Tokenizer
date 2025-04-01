import { ethers } from "hardhat";
import { expect } from "chai";
import {
	Tokenizer__factory, Tokenizer,
	VRFConsumer__factory, VRFConsumer,
	VRFCoordinatorV2_5Mock__factory, VRFCoordinatorV2_5Mock,
	BiscaTreasury__factory, BiscaTreasury
} from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { Log, LogDescription } from "ethers";

describe("Tokenizer (Using Deployed Contract)", function () {
	let tokenizer: Tokenizer;
	let vrfConsumer: VRFConsumer;
	let mockVRFCoordinator: VRFCoordinatorV2_5Mock;
	let biscaTreasury: BiscaTreasury;
	let owner: SignerWithAddress,
		owner2: SignerWithAddress,
		owner3: SignerWithAddress,
		user1: SignerWithAddress;
	const tokenizerAddress: string = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";
	const biscaTreasuryAddress: string = "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707";

	before(async function () {

		[owner, owner2, owner3, user1] = await ethers.getSigners();

		// Get contract instances
		tokenizer = Tokenizer__factory.connect(tokenizerAddress, owner);

		const vrfConsumerAddress = await tokenizer.vrfConsumer();
		vrfConsumer = VRFConsumer__factory.connect(vrfConsumerAddress, owner);

		const vrfCoordinatorAddress = await vrfConsumer.s_vrfCoordinator();
		mockVRFCoordinator = VRFCoordinatorV2_5Mock__factory.connect(vrfCoordinatorAddress, owner);

		biscaTreasury = BiscaTreasury__factory.connect(biscaTreasuryAddress, owner);

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

	describe("BiscaTreasury", function () {
		it("Should allow BiscaTreasury to mint tokens", async function () {
			const mintAmount = ethers.parseEther("100");
			const initialBalance = await tokenizer.balanceOf(owner2.address);
			const expectedBalance = initialBalance + mintAmount;

			// Propose mint transaction
			const tx = await biscaTreasury.proposeMint(owner2.address, mintAmount);
			const receipt = await tx.wait();

			if (!receipt) {
				throw new Error("Transaction receipt is null");
			}

			// Fetch the transaction ID from the emitted event
			const event = receipt?.logs
				.map((log: Log) => biscaTreasury.interface.parseLog(log))
				.find((parsedLog: LogDescription | null) => parsedLog?.name === "TransactionSubmitted");

			if (!event) {
				throw new Error("TransactionSubmitted event not found in receipt logs");
			}

			const txId = event?.args[0];

			// Execute mint transaction
			await biscaTreasury.approveTransaction(txId);
			await biscaTreasury.connect(owner2).approveTransaction(txId);
			await biscaTreasury.executeTransaction(txId);

			// Verify balance
			expect(await tokenizer.balanceOf(owner2.address)).to.equal(expectedBalance);
		});

		it("Should allow BiscaTreasury to burn tokens", async function () {
			const burnAmount = ethers.parseEther("50");
			const initialBalance = await tokenizer.balanceOf(owner2.address);
			const expectedBalance = initialBalance - burnAmount;

			// Propose burn transaction
			const tx = await biscaTreasury.proposeBurn(owner2.address, burnAmount);
			const receipt = await tx.wait();

			if (!receipt) {
				throw new Error("Transaction receipt is null");
			}

			// Fetch the transaction ID from the emitted event
			const event = receipt?.logs
				.map((log: Log) => biscaTreasury.interface.parseLog(log))
				.find((parsedLog: LogDescription | null) => parsedLog?.name === "TransactionSubmitted");

			if (!event) {
				throw new Error("TransactionSubmitted event not found in receipt logs");
			}

			const txId = event?.args[0];

			// Execute burn transaction
			await biscaTreasury.approveTransaction(txId);
			await biscaTreasury.connect(owner2).approveTransaction(txId);
			await biscaTreasury.executeTransaction(txId);

			// Verify balance
			expect(await tokenizer.balanceOf(owner2.address)).to.equal(expectedBalance);
		});

		it("Should not allow unauthorized accounts to mint tokens", async function () {
			const mintAmount = ethers.parseEther("100");

			// Attempt to propose mint from unauthorized account
			await expect(
				biscaTreasury.connect(user1).proposeMint(user1.address, mintAmount)
			).to.be.revertedWith("Multisig: caller is not the owner");
		});

		it("Should not allow unauthorized accounts to burn tokens", async function () {
			const mintAmount = ethers.parseEther("100");

			// Attempt to propose mint from unauthorized account
			await expect(
				biscaTreasury.connect(user1).proposeBurn(user1.address, mintAmount)
			).to.be.revertedWith("Multisig: caller is not the owner");
		});
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
			await tokenizer.grantRole(await tokenizer.MINTER_ROLE(), owner.address);
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

	describe("Random Events", function () {
		it("Should trigger random event", async function () {
			await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
			await ethers.provider.send("evm_mine");
			await expect(tokenizer.connect(owner).triggerRandomEvent())
				.to.emit(tokenizer, "RandomEventTriggered");
		});

		it("Should not allow random event before interval", async function () {
			await expect(tokenizer.connect(owner).triggerRandomEvent()).to.be.revertedWith("Too soon for a random event");
		});

		it("Should process random words and mint tokens on even number", async function () {
			// Trigger random event
			await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
			await ethers.provider.send("evm_mine");
			const tx = await tokenizer.connect(owner).triggerRandomEvent();
			const receipt = await tx.wait();

		if (!receipt) {
			throw new Error("Transaction receipt is null");
		}


			const event = receipt?.logs
				.map((log: Log) => biscaTreasury.interface.parseLog(log))
				.find((parsedLog: LogDescription | null) => parsedLog?.name === "RandomEventTriggered");

			if (!event) {
				throw new Error("TransactionSubmitted event not found in receipt logs");
			}

			// const txId = event?.args[0];
			// Find the RandomEventTriggered event
			// const event = receipt?.logs.find(
			// 	(log) => log.fragment && log.fragment.name === "RandomEventTriggered"
			// );

			const requestId = event?.args ? event.args[0] : undefined;
			// Get initial balance
			const initialBalance = await tokenizer.balanceOf(owner.address);
			console.log("request ID: " + requestId);

			// Mock VRF response (even number → mint)
			await mockVRFCoordinator.fulfillRandomWordsWithOverride(
				requestId,
				await vrfConsumer.getAddress(),
				[2]
			);
			await tokenizer.connect(owner).handleRandomness(requestId);

			// Verify balance increased
			const finalBalance = await tokenizer.balanceOf(owner.address);
			expect(finalBalance).to.be.greaterThan(initialBalance);
		});

		it("Should process random words and burn tokens on odd number", async function () {
			// Trigger random event
			await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
			await ethers.provider.send("evm_mine");
			const tx = await tokenizer.connect(owner).triggerRandomEvent();
			const receipt = await tx.wait();

			if (!receipt) {
				throw new Error("Transaction receipt is null");
			}

			// Find the RandomEventTriggered event
			const event = receipt?.logs
				.map((log: Log) => biscaTreasury.interface.parseLog(log))
				.find((parsedLog: LogDescription | null) => parsedLog?.name === "RandomEventTriggered");

			if (!event) {
				throw new Error("TransactionSubmitted event not found in receipt logs");
			}

			const requestId = event?.args ? event.args[0] : undefined;
			// Get initial balance
			const initialBalance = await tokenizer.balanceOf(owner.address);

			// Mock VRF response
			await mockVRFCoordinator.fulfillRandomWordsWithOverride(requestId, vrfConsumer.target, [1]);
			await tokenizer.connect(owner).handleRandomness(requestId);

			// Verify balance changed
			const finalBalance = await tokenizer.balanceOf(owner.address);
			expect(finalBalance).to.be.lessThan(initialBalance);
		});
	});
});
