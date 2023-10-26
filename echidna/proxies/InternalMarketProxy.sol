// SPDX-License-Identifier: MIT

pragma solidity 0.8.16;

import "./TokenMock.sol";
import "../../contracts/InternalMarket/InternalMarket.sol";
import "../../contracts/PriceOracle/PriceOracle.sol";

contract InternalMarketProxy {
    InternalMarket internalMarket;

    uint256 total;
    address[3] accounts = [
        address(0x1000000000000000000000000000000000000000),
        0x2000000000000000000000000000000000000000,
        0x3000000000000000000000000000000000000000
    ];

    constructor() {
        TokenMock usdc = new TokenMock("Circle USD", "USDC");
        TokenMock daoToken = new TokenMock("Dao Token", "TOKEN");
        internalMarket = new InternalMarket(daoToken);
        PriceOracle oracle = new PriceOracle();
        string[] memory symbols = new string[](2);
        symbols[0] = "USDC";
        symbols[1] = "EUR";
        uint64[] memory rates = new uint64[](2);
        rates[0] = 998524180000000000;
        rates[1] = 1067631500000000128;
        uint64[] memory timestamps = new uint64[](2);
        timestamps[0] = 1678875700;
        timestamps[1] = 1678875700;
        oracle.relay(symbols, rates, timestamps);

        usdc.mint(accounts[0], 1000);
        usdc.mint(accounts[1], 1000);
        usdc.mint(accounts[2], 1000);

        daoToken.mint(accounts[0], 1000);
        daoToken.mint(accounts[1], 1000);
        daoToken.mint(accounts[2], 1000);

        internalMarket.setDaoToken(daoToken);
        internalMarket.setExchangePair(usdc, oracle);
    }

    function market_makeOffer(uint8 amount) public {
        internalMarket.makeOffer(amount);
    }

    function market_matchOffer(uint8 amount, uint8 accountIndex) public {
        internalMarket.matchOffer(accounts[accountIndex % 3], amount);
    }

    function redemption_withdraw(address to, uint8 amount) public {
        internalMarket.withdraw(to, amount);
    }

    function echidna_verifyBalance() public view returns (bool) {
        return
            internalMarket.withdrawableBalanceOf(msg.sender) <=
            internalMarket.offeredBalanceOf(msg.sender);
    }
}
