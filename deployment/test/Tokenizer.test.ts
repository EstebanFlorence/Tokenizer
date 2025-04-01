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
import { token } from "../typechain-types/@openzeppelin/contracts";

describe("Tokenizer", function () {
	let tokenizer: Tokenizer;
	let vrfConsumer: VRFConsumer;
	let mockVRFCoordinator: VRFCoordinatorV2_5Mock;
	let biscaTreasury: BiscaTreasury;
	let owner: SignerWithAddress,
		owner2: SignerWithAddress,
		owner3: SignerWithAddress,
		user1: SignerWithAddress;

	const keyHash: string = "0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc";
	const initialSupply: bigint = ethers.parseEther("1000000");

	async function deployTokenizerFixture() {

		[owner, owner2, owner3, user1] = await ethers.getSigners();

		// Deploy VRFCoordinatorV2_5Mock
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
			throw new Error("SubscriptionCreated event not found in receipt logs");
		}

		const subscriptionId = event?.args[0];

		// Deploy VRFConsumer
		vrfConsumer = await new VRFConsumer__factory(owner).deploy(
			await mockVRFCoordinator.getAddress(),
			subscriptionId,
			keyHash
		  );
		  
		// Deploy Tokenizer
		tokenizer = await new Tokenizer__factory(owner).deploy(
			initialSupply,
			await vrfConsumer.getAddress()
		  );
		  
		  // Deploy BiscaTreasury
		  const owners = [owner.address, owner2.address, owner3.address];
		  const requiredSignatures = 2;
		  biscaTreasury = await new BiscaTreasury__factory(owner).deploy(
			await vrfConsumer.getAddress(),
			await tokenizer.getAddress(),
			owners,
			requiredSignatures
		  );

		// Fund the subscription
		await mockVRFCoordinator.fundSubscription(subscriptionId, ethers.parseEther("7"));

		// Add consumer to VRF
		await mockVRFCoordinator.addConsumer(subscriptionId, vrfConsumer);

		// Grant roles to BiscaTreasury
		const MINTER_ROLE = await tokenizer.MINTER_ROLE();
		const BURNER_ROLE = await tokenizer.BURNER_ROLE();
		await tokenizer.grantRole(MINTER_ROLE, await biscaTreasury.getAddress());
		await tokenizer.grantRole(BURNER_ROLE, await biscaTreasury.getAddress());

		return { tokenizer, biscaTreasury, mockVRFCoordinator, subscriptionId, owner, owner2, owner3, user1 };
	}

	describe("BiscaTreasury", function () {
		it("Should allow BiscaTreasury to mint tokens", async function () {
			const { tokenizer, biscaTreasury, owner2 } = await deployTokenizerFixture();
			const mintAmount = ethers.parseEther("100");

			// Propose mint transaction
			await biscaTreasury.proposeMint(owner2.address, mintAmount);

			// Execute mint transaction
			const txId = 0; // Assuming this is the first transaction
			await biscaTreasury.approveTransaction(txId);
			await biscaTreasury.connect(owner2).approveTransaction(txId);
			await biscaTreasury.executeTransaction(txId);

			// Verify balance
			expect(await tokenizer.balanceOf(owner2.address)).to.equal(mintAmount);
		});

		it("Should allow BiscaTreasury to burn tokens", async function () {
			const { tokenizer, biscaTreasury, owner2 } = await deployTokenizerFixture();
			const mintAmount = ethers.parseEther("100");
			const burnAmount = ethers.parseEther("50");

			// Mint tokens to owner2
			await biscaTreasury.proposeMint(owner2.address, mintAmount);
			await biscaTreasury.approveTransaction(0);
			await biscaTreasury.connect(owner2).approveTransaction(0);
			await biscaTreasury.executeTransaction(0);

			// Propose burn transaction
			await biscaTreasury.proposeBurn(owner2.address, burnAmount);

			// Execute burn transaction
			const txId = 1; // Assuming this is the second transaction
			await biscaTreasury.approveTransaction(txId);
			await biscaTreasury.connect(owner2).approveTransaction(txId);
			await biscaTreasury.executeTransaction(txId);

			// Verify balance
			expect(await tokenizer.balanceOf(owner2.address)).to.equal(mintAmount - burnAmount);
		});

		it("Should not allow unauthorized accounts to mint tokens", async function () {
			const { biscaTreasury, user1 } = await deployTokenizerFixture();
			const mintAmount = ethers.parseEther("100");

			// Attempt to propose mint from unauthorized account
			await expect(
				biscaTreasury.connect(user1).proposeMint(user1.address, mintAmount)
			).to.be.revertedWith("Multisig: caller is not the owner");
		});

		it("Should not allow unauthorized accounts to burn tokens", async function () {
			const { biscaTreasury, user1 } = await deployTokenizerFixture();
			const mintAmount = ethers.parseEther("100");

			// Attempt to propose mint from unauthorized account
			await expect(
				biscaTreasury.connect(user1).proposeBurn(user1.address, mintAmount)
			).to.be.revertedWith("Multisig: caller is not the owner");
		});
	});

	describe("Deployment", function () {
		it("Should set the right owner", async function () {
			const { tokenizer, owner } = await deployTokenizerFixture();
			expect(await tokenizer.hasRole(await tokenizer.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
		});

		it("Should assign the total supply to the owner", async function () {
			const { tokenizer, owner } = await deployTokenizerFixture();
			const ownerBalance = await tokenizer.balanceOf(owner.address);
			expect(await tokenizer.totalSupply()).to.equal(ownerBalance);
		});
	});

	describe("Pausing", function () {
		it("Should allow owner to pause and unpause the contract", async function () {
			const { tokenizer } = await deployTokenizerFixture();
			await tokenizer.pause();
			expect(await tokenizer.paused()).to.be.true;
			await tokenizer.unpause();
			expect(await tokenizer.paused()).to.be.false;
		});

		it("Should not allow non-owner to pause or unpause the contract", async function () {
			const { tokenizer, owner2 } = await deployTokenizerFixture();
			await expect(tokenizer.connect(owner2).pause())
			.to.be.revertedWithCustomError(tokenizer, "AccessControlUnauthorizedAccount")
			.withArgs(owner2.address, await tokenizer.PAUSER_ROLE());
			await expect(tokenizer.connect(owner2).pause())
			.to.be.revertedWithCustomError(tokenizer, "AccessControlUnauthorizedAccount")
			.withArgs(owner2.address, await tokenizer.PAUSER_ROLE());
		});

		it("Should not allow minting when paused", async function () {
			const { tokenizer, owner, owner2 } = await deployTokenizerFixture();
			const mintAmount = ethers.parseEther("100");
			await tokenizer.pause();
			await tokenizer.grantRole(await tokenizer.MINTER_ROLE(), owner.address);
			await expect(tokenizer.mint(owner2.address, mintAmount))
				.to.be.revertedWithCustomError(tokenizer, "EnforcedPause");
		});

		it("Should allow minting when unpaused", async function () {
			const { tokenizer, owner, owner2 } = await deployTokenizerFixture();
			const mintAmount = ethers.parseEther("100");
			await tokenizer.pause();
			await tokenizer.unpause();
			await tokenizer.grantRole(await tokenizer.MINTER_ROLE(), owner.address);
			await tokenizer.mint(owner2.address, mintAmount);
			expect(await tokenizer.balanceOf(owner2.address)).to.equal(mintAmount);
		});
	});

	describe("Random Events", function () {
		it("Should trigger random event", async function () {
			const { tokenizer } = await deployTokenizerFixture();

			await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]); // +1 day
			await ethers.provider.send("evm_mine"); // Mine a new block
			await expect(tokenizer.triggerRandomEvent())
				.to.emit(tokenizer, "RandomEventTriggered")
		});

		it("Should not allow random event before interval", async function () {
			const { tokenizer } = await deployTokenizerFixture();

			await expect(tokenizer.triggerRandomEvent())
				.to.be.revertedWith("Too soon for a random event");
		});

		it("Should process random words and mint tokens on even number", async function () {
			const { tokenizer, mockVRFCoordinator, owner } = await deployTokenizerFixture();
			
			// Trigger random event
			await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
			await ethers.provider.send("evm_mine");
			const tx = await tokenizer.triggerRandomEvent();
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
	
			const requestId = event?.args[0];

			// Get initial balance
			const initialBalance = await tokenizer.balanceOf(owner.address);
			console.log("request ID: " + requestId);

			// Mock VRF response with even number (will trigger mint)
			await mockVRFCoordinator.fulfillRandomWordsWithOverride(
				requestId,
				await vrfConsumer.getAddress(),
				[2]
			);
			await tokenizer.handleRandomness(requestId);

			// Verify balance increased
			const finalBalance = await tokenizer.balanceOf(owner.address);
			expect(finalBalance).to.be.greaterThan(initialBalance);
		});

		it("Should process random words and burn tokens on odd number", async function () {
			const { tokenizer, mockVRFCoordinator, owner } = await deployTokenizerFixture();
			
			// Trigger random event
			await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
			await ethers.provider.send("evm_mine");
			const tx = await tokenizer.triggerRandomEvent();
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
	
			const requestId = event?.args[0];

			// Get initial balance
			const initialBalance = await tokenizer.balanceOf(owner.address);

			// Mock VRF response
			await mockVRFCoordinator.fulfillRandomWordsWithOverride(
				requestId,
				await vrfConsumer.getAddress(),
				[1]
			);
			await tokenizer.handleRandomness(requestId);

			// Verify balance changed
			const finalBalance = await tokenizer.balanceOf(owner.address);
			expect(finalBalance).to.lessThan(initialBalance);
		});
	});
});
