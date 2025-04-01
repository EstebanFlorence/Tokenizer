import { ethers } from "hardhat";
import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import {
	Tokenizer__factory, Tokenizer,
	VRFConsumer__factory, VRFConsumer,
	VRFCoordinatorV2_5Mock__factory, VRFCoordinatorV2_5Mock,
	BiscaTreasury__factory, BiscaTreasury
} from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { Log, LogDescription } from "ethers";

describe("VRFConsumer", function () {
	let vrfConsumer: VRFConsumer;
	let mockVRFCoordinator: VRFCoordinatorV2_5Mock;
	let biscaTreasury: BiscaTreasury;
	let owner: SignerWithAddress,
		user1: SignerWithAddress,
		user2: SignerWithAddress;

	const keyHash: string = "0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc";

	async function deployTokenizerFixture() {

		[owner, user1, user2] = await ethers.getSigners();

		// Deploy VRF Coordinator Mock
		mockVRFCoordinator = await new VRFCoordinatorV2_5Mock__factory(owner).deploy(
			100000,
			1e9,
			6110300000000000
		);

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
			throw new Error("TransactionSubmitted event not found in receipt logs");
		}

		const subscriptionId = event?.args[0];

		// Deploy VRFConsumer
		vrfConsumer = await new VRFConsumer__factory(owner).deploy(
			await mockVRFCoordinator.getAddress(),
			subscriptionId,
			keyHash
		);

		// Fund the subscription
		await mockVRFCoordinator.fundSubscription(subscriptionId, ethers.parseEther("7"));

		// Add consumer to VRF
		await mockVRFCoordinator.addConsumer(subscriptionId, await vrfConsumer.getAddress());

		return { vrfConsumer, mockVRFCoordinator, owner, user1, user2, subscriptionId };
	}

	describe("fulfillRandomWords", function () {
		it("Should request randomness and emit event", async function () {
			const { vrfConsumer, owner } = await loadFixture(deployTokenizerFixture);
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
			const { vrfConsumer } = await loadFixture(deployTokenizerFixture);
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
			const { vrfConsumer } = await loadFixture(deployTokenizerFixture);
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
				[44]
			);

			await expect(vrfConsumer.connect(user1).getRandomness(requestId)).to.be.revertedWith("Caller is not the requester");
		});
	});

	describe("clearRandomRequest", function () {
		it("Should clear the request data", async function () {
			const { vrfConsumer } = await loadFixture(deployTokenizerFixture);
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
				[777]
			);

			await vrfConsumer.clearRandomRequest(requestId);

			await expect(vrfConsumer.getRandomness(requestId)).to.be.revertedWith("Caller is not the requester");
		});
	});
});