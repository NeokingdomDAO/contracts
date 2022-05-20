// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../Voting/Voting.sol";

contract ERC20Mock is Initializable, ERC20Upgradeable {
    Voting _voting;

    
    function initialize(Voting voting) public initializer {
        _voting = voting;
        __ERC20_init("Mock", "MOCK");
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {
    }

    function mint(address account, uint256 amount) public {
        _mint(account, amount);
    }

    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        _voting.afterTokenTransfer(from, to, amount);
    }
}
