// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "../Voting/IVoting.sol";
import "../InternalMarket/InternalMarket.sol";
import "../ShareholderRegistry/IShareholderRegistry.sol";

contract TelediskoTokenBase is ERC20Upgradeable {
    IVoting internal _voting;
    InternalMarket internal _internalMarket;
    IShareholderRegistry internal _shareholderRegistry;

    function initialize(
        string memory name,
        string memory symbol
    ) public virtual {
        __ERC20_init(name, symbol);
    }

    event VestingSet(address to, uint256 amount);

    // TODO: what happens to vesting tokens when someone loses the contributor status?
    // In theory they should be burned or added to a pool
    mapping(address => uint256) internal _vestingBalance;

    // mapping(address => uint256) internal _unlockedBalance;

    function _setInternalMarket(InternalMarket internalMarket) internal {
        _internalMarket = internalMarket;
    }

    function _setVoting(IVoting voting) internal {
        _voting = voting;
    }

    function _setShareholderRegistry(
        IShareholderRegistry shareholderRegistry
    ) internal virtual {
        _shareholderRegistry = shareholderRegistry;
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        super._beforeTokenTransfer(from, to, amount);

        require(
            _msgSender() == address(_internalMarket) ||
                !_shareholderRegistry.isAtLeast(
                    _shareholderRegistry.CONTRIBUTOR_STATUS(),
                    from
                ),
            "TelediskoToken: contributor cannot transfer"
        );
    }

    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        super._afterTokenTransfer(from, to, amount);
        _voting.afterTokenTransfer(from, to, amount);

        // Invariants
        require(
            balanceOf(from) >= _vestingBalance[from],
            "TelediskoToken: transfer amount exceeds vesting"
        );
    }

    // TODO: ask Marko whether vesting tokens can be given only to contributors
    function _mintVesting(address to, uint256 amount) internal virtual {
        _vestingBalance[to] += amount;
        _mint(to, amount);
        emit VestingSet(to, _vestingBalance[to]);
    }

    function _setVesting(address account, uint256 amount) internal virtual {
        require(
            amount < _vestingBalance[account],
            "TelediskoToken: vesting can only be decreased"
        );
        _vestingBalance[account] = amount;
        emit VestingSet(account, amount);
    }

    // Tokens that are still in the vesting phase
    function vestingBalanceOf(
        address account
    ) public view virtual returns (uint256) {
        return _vestingBalance[account];
    }
}
