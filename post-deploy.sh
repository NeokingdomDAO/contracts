WALLETS_FILE=$1
NETWORK=$2
echo "Granting OPERATOR_ROLE on ResolutionManager"
cat $WALLETS_FILE | xargs -n1 -IWALLET npx hardhat grant-role --contract ResolutionManager --role OPERATOR_ROLE --account WALLET --network $NETWORK
echo "Granting OPERATOR_ROLE on ShareholderRegistry"
cat $WALLETS_FILE | xargs -n1 -IWALLET npx hardhat grant-role --contract ShareholderRegistry --role OPERATOR_ROLE --account WALLET --network $NETWORK
echo "Minting shares"
cat $WALLETS_FILE | xargs -n1 -IWALLET npx hardhat mint-share WALLET --network $NETWORK
echo "Setting MANAGING_BOARD status"
cat $WALLETS_FILE | xargs -n1 -IWALLET npx hardhat set --account WALLET --status managing_board --network $NETWORK
echo "Minting tokens"
cat $WALLETS_FILE | xargs -n1 -IWALLET npx hardhat mint --account WALLET --amount 42 --network $NETWORK
