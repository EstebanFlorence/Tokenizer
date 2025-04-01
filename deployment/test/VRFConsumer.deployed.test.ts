import { ethers } from "hardhat";
import { expect } from "chai";
import { Log, LogDescription } from "ethers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
	Tokenizer__factory, Tokenizer,
	VRFConsumer__factory, VRFConsumer,
	VRFCoordinatorV2_5Mock__factory, VRFCoordinatorV2_5Mock,
} from "../typechain-types";

describe("VRFConsumer (Using Deployed Contract)", function () {
	let vrfConsumer: VRFConsumer;
	let mockVRFCoordinator: VRFCoordinatorV2_5Mock;
	let tokenizer: Tokenizer;
	let owner: SignerWithAddress,
		user1: SignerWithAddress;

	const tokenizerAddress: string = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";

	before(async function () {

		[owner, user1] = await ethers.getSigners();

		// Get contract instances
		tokenizer = Tokenizer__factory.connect(tokenizerAddress, owner);

		const vrfConsumerAddress = await tokenizer.vrfConsumer();
		vrfConsumer = VRFConsumer__factory.connect(vrfConsumerAddress, owner);

		const vrfCoordinatorAddress = await vrfConsumer.s_vrfCoordinator();
		mockVRFCoordinator = VRFCoordinatorV2_5Mock__factory.connect(vrfCoordinatorAddress, owner);

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

		// Add consumer
		try {
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

	describe("fulfillRandomWords", function () {
		it("Should request randomness and emit event", async function () {
			const tx = await vrfConsumer.requestRandomness();
			const receipt = await tx.wait();

			if (!receipt) {
				throw new Error("Transaction receipt is null");
			}

			// Fetch the request ID from the emitted event
			const event = receipt?.logs
				.map((log: Log) => vrfConsumer.interface.parseLog(log))
				.find((parsedLog: LogDescription | null) => parsedLog?.name === "RandomnessRequested");

			if (!event) {
				throw new Error("RandomnessRequested event not found in receipt logs");
			}

			const requestId = event?.args ? event.args[0] : undefined;

			expect(event).to.not.be.undefined;
			expect(requestId).to.not.be.undefined;
			expect(event.args.requester).to.equal(owner.address);
		});
	});

	describe("getRandomness", function () {
		it("Should return the correct randomness for the requester", async function () {
			const tx = await vrfConsumer.requestRandomness();
			const receipt = await tx.wait();

			if (!receipt) {
				throw new Error("Transaction receipt is null");
			}

			// Fetch the request ID from the emitted event
			const event = receipt?.logs
				.map((log: Log) => vrfConsumer.interface.parseLog(log))
				.find((parsedLog: LogDescription | null) => parsedLog?.name === "RandomnessRequested");

			if (!event) {
				throw new Error("RandomnessRequested event not found in receipt logs");
			}

			const requestId = event?.args ? event.args[0] : undefined;

			// Mock VRF response
			await mockVRFCoordinator.fulfillRandomWordsWithOverride(
				requestId,
				await vrfConsumer.getAddress(),
				[23]
			);

			const randomness = await vrfConsumer.getRandomness(requestId);
			expect(randomness).to.equal(23);
		});

		it("Should revert if called by non-requester", async function () {
			const tx = await vrfConsumer.requestRandomness();
			const receipt = await tx.wait();

			if (!receipt) {
				throw new Error("Transaction receipt is null");
			}

			// Fetch the request ID from the emitted event
			const event = receipt?.logs
				.map((log: Log) => vrfConsumer.interface.parseLog(log))
				.find((parsedLog: LogDescription | null) => parsedLog?.name === "RandomnessRequested");

			if (!event) {
				throw new Error("RandomnessRequested event not found in receipt logs");
			}

			const requestId = event?.args ? event.args[0] : undefined;

			// Mock VRF response
			await mockVRFCoordinator.fulfillRandomWordsWithOverride(
				requestId,
				await vrfConsumer.getAddress(),
				[23]
			);

			await expect(vrfConsumer.connect(user1).getRandomness(requestId)).to.be.revertedWith("Caller is not the requester");
		});
	});

	describe("clearRandomRequest", function () {
		it("Should clear the request data", async function () {
			const tx = await vrfConsumer.requestRandomness();
			const receipt = await tx.wait();

			if (!receipt) {
				throw new Error("Transaction receipt is null");
			}

			// Fetch the request ID from the emitted event
			const event = receipt?.logs
				.map((log: Log) => vrfConsumer.interface.parseLog(log))
				.find((parsedLog: LogDescription | null) => parsedLog?.name === "RandomnessRequested");

			if (!event) {
				throw new Error("RandomnessRequested event not found in receipt logs");
			}

			const requestId = event?.args ? event.args[0] : undefined;

			// Mock VRF response
			await mockVRFCoordinator.fulfillRandomWordsWithOverride(
				requestId,
				await vrfConsumer.getAddress(),
				[23]
			);

			await vrfConsumer.clearRandomRequest(requestId);

			await expect(vrfConsumer.getRandomness(requestId)).to.be.revertedWith("Caller is not the requester");
		});
	});
});