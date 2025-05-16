module.exports = [
	// _vrfConsumer
	process.env.VRF_CONSUMER_ADDRESS,
	// _tokenizer
	process.env.TOKENIZER_ADDRESS,
	// _owners (address[])
	[
	  process.env.DEPLOYER_ADDRESS,
	  process.env.OWNER2_ADDRESS,
	  process.env.OWNER3_ADDRESS
	],
	// _requiredSignatures
	parseInt(process.env.REQUIRED_SIGNATURES, 10)
  ];
  