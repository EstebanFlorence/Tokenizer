const { ethers } = require("hardhat");
const { expect } = require('chai');

describe("Tokenizer", function () {
	let Tokenizer, tokenizer, owner, addr1, addr2;

	beforeEach(async function () {

        // Set up ethers contract, representing deployed Tokenizer instance
		Tokenizer = await ethers.getContractFactory("Tokenizer");

		// Retrieve accounts from the local node
		[owner, addr1, addr2, _] = await ethers.getSigners();
		
		tokenizer = await Tokenizer.deploy(ethers.parseUnits('1000', 18));
		// await tokenizer.deployed();
	});

	it("Should assign the initial supply to the owner", async function () {
		const ownerBalance = await tokenizer.balanceOf(owner.address);
		expect(await tokenizer.totalSupply()).to.equal(ownerBalance);
	});

	it("Should allow the owner to mint tokens", async function () {
		await tokenizer.mint(addr1.address, ethers.parseUnits('500', 18));
		const addr1Balance = await tokenizer.balanceOf(addr1.address);
		expect(addr1Balance).to.equal(ethers.parseUnits('500', 18));
	});

	it("Should not allow non-owners to mint tokens", async function () {
		await expect(
			tokenizer.connect(addr1).mint(addr2.address, ethers.parseUnits('500', 18))
		).to.be.reverted/* With("Ownable: caller is not the owner") */;
	});

})
