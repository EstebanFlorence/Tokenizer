# 1. VRFConsumer
npx hardhat verify --network sepolia \
  $VRF_CONSUMER_ADDRESS \
  $VRF_COORDINATOR_ADDRESS \
  $VRF_SUBSCRIPTION_ID \
  $VRF_KEY_HASH

# 2. Tokenizer
npx hardhat verify --network sepolia \
  $TOKENIZER_ADDRESS \
  $INITIAL_SUPPLY \

# 3. Treasury
npx hardhat verify \
  --network sepolia \
  --constructor-args scripts/args‑treasury.js \
  $TREASURY_ADDRESS

# 4. Dealer
npx hardhat verify --network sepolia \
  $DEALER_ADDRESS \
  $VRF_CONSUMER_ADDRESS \
  $TOKENIZER_ADDRESS \
  $TREASURY_ADDRESS \
  $MIN_BET \
  $MAX_BET \
  $HOUSE_EDGE
