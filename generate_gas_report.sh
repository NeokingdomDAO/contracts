#!/bin/bash

REPORT_FOLDER=${1-.}

# Based on 2022 data
AVG_MIN_ETH=48
AVG_MAX_ETH=146
MED_MIN_ETH=36
MED_MAX_ETH=126
AVG_MIN_MATIC=80
AVG_MAX_MATIC=267
MED_MIN_MATIC=37
MED_MAX_MATIC=71

echo "generating ETH reports..."
REPORT_GAS=true GAS_PRICE=$AVG_MIN_ETH TOKEN=ETH GASREPORT_FILE=$REPORT_FOLDER/eth_avg_min.txt npx hardhat test test/Integration.ts > /dev/null
REPORT_GAS=true GAS_PRICE=$AVG_MAX_ETH TOKEN=ETH GASREPORT_FILE=$REPORT_FOLDER/eth_avg_max.txt npx hardhat test test/Integration.ts > /dev/null
REPORT_GAS=true GAS_PRICE=$MED_MIN_ETH TOKEN=ETH GASREPORT_FILE=$REPORT_FOLDER/eth_med_min.txt npx hardhat test test/Integration.ts > /dev/null
REPORT_GAS=true GAS_PRICE=$MED_MAX_ETH TOKEN=ETH GASREPORT_FILE=$REPORT_FOLDER/eth_med_max.txt npx hardhat test test/Integration.ts > /dev/null

echo "generating MATIC reports..."
REPORT_GAS=true GAS_PRICE=$AVG_MIN_MATIC TOKEN=MATIC GASREPORT_FILE=$REPORT_FOLDER/matic_avg_min.txt npx hardhat test test/Integration.ts > /dev/null
REPORT_GAS=true GAS_PRICE=$AVG_MAX_MATIC TOKEN=MATIC GASREPORT_FILE=$REPORT_FOLDER/matic_avg_max.txt npx hardhat test test/Integration.ts > /dev/null
REPORT_GAS=true GAS_PRICE=$MED_MIN_MATIC TOKEN=MATIC GASREPORT_FILE=$REPORT_FOLDER/matic_med_min.txt npx hardhat test test/Integration.ts > /dev/null
REPORT_GAS=true GAS_PRICE=$MED_MAX_MATIC TOKEN=MATIC GASREPORT_FILE=$REPORT_FOLDER/matic_med_max.txt npx hardhat test test/Integration.ts > /dev/null