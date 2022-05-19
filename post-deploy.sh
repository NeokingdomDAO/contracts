WALLETS_FILE=$1
echo "Granting OPERATOR_ROLE on ResolutionManager"
cat $WALLETS_FILE | xargs -n1 -IWALLET npx hardhat grant-role --contract ResolutionManager --role OPERATOR_ROLE --account WALLET --network mumbai
echo "Granting OPERATOR_ROLE on ShareholderRegistry"
cat $WALLETS_FILE | xargs -n1 -IWALLET npx hardhat grant-role --contract ShareholderRegistry --role OPERATOR_ROLE --account WALLET --network mumbai
echo "Minting shares"
cat $WALLETS_FILE | xargs -n1 -IWALLET npx hardhat mint-share WALLET --network mumbai
echo "Setting MANAGING_BOARD status"
cat $WALLETS_FILE | xargs -n1 -IWALLET npx hardhat set --account WALLET --status managing_board --network mumbai
echo "Minting tokens"
cat $WALLETS_FILE | xargs -n1 -IWALLET npx hardhat mint --account WALLET --amount 42 --network mumbai
