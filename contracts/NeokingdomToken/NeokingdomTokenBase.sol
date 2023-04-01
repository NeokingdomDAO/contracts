// SPDX-License-Identifier: MIT

pragma solidity ^0.8.16;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "../RedemptionController/IRedemptionController.sol";
import "../Voting/IVoting.sol";
import "../InternalMarket/InternalMarket.sol";
import "../extensions/DAORoles.sol";
import "./INeokingdomToken.sol";

abstract contract NeokingdomTokenBase is ERC20Upgradeable, INeokingdomToken {
    event VestingSet(address to, uint256 amount);

    IVoting internal _voting;
    InternalMarket internal _internalMarket;
    IRedemptionController internal _redemptionController;

    function _initialize(
        string memory name,
        string memory symbol
    ) internal virtual {
        __ERC20_init(name, symbol);
    }

    // TODO: what happens to vesting tokens when someone loses the contributor status?
    // In theory they should be burned or added to a pool
    mapping(address => uint256) internal _vestingBalance;

    // mapping(address => uint256) internal _unlockedBalance;

    function _setInternalMarket(
        InternalMarket internalMarket
    ) internal virtual {
        _internalMarket = internalMarket;
    }

    function _setVoting(IVoting voting) internal {
        _voting = voting;
    }

    function _setRedemptionController(
        IRedemptionController redemptionController
    ) internal virtual {
        _redemptionController = redemptionController;
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        super._beforeTokenTransfer(from, to, amount);

        require(
            from == address(0) || _msgSender() == address(_internalMarket),
            "NeokingdomToken: contributor cannot transfer"
        );
    }

    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        super._afterTokenTransfer(from, to, amount);
        _voting.afterTokenTransfer(from, to, amount);

        if (from == address(0)) {
            _redemptionController.afterMint(to, amount);
        }

        // Invariants
        require(
            balanceOf(from) >= _vestingBalance[from],
            "NeokingdomToken: transfer amount exceeds vesting"
        );
    }

    // TODO: ask Marko whether vesting tokens can be given only to contributors
    function _mintVesting(address to, uint256 amount) internal virtual {
        _vestingBalance[to] += amount;
        emit VestingSet(to, _vestingBalance[to]);
        _mint(to, amount);
    }

    function _setVesting(address account, uint256 amount) internal virtual {
        require(
            amount < _vestingBalance[account],
            "NeokingdomToken: vesting can only be decreased"
        );
        emit VestingSet(account, amount);
        _vestingBalance[account] = amount;
    }

    // Tokens that are still in the vesting phase
    function vestingBalanceOf(
        address account
    ) public view virtual returns (uint256) {
        return _vestingBalance[account];
    }
}
