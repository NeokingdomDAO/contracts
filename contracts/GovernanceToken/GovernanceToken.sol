// SPDX-License-Identifier: MIT

pragma solidity ^0.8.16;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "./GovernanceTokenSnapshot.sol";
import { Roles } from "../extensions/Roles.sol";
import "../extensions/DAORoles.sol";
import "../extensions/HasRole.sol";

contract GovernanceToken is Initializable, HasRole, GovernanceTokenSnapshot {
    IShareholderRegistry internal _shareholderRegistry;

    event DepositStarted(
        address from,
        uint256 amount,
        uint256 settlementTimestamp
    );

    struct DepositedTokens {
        uint256 amount;
        uint256 settlementTimestamp;
    }

    mapping(address => DepositedTokens[]) depositedTokens;

    uint256 settlementPeriod;

    function initialize(
        DAORoles roles,
        string memory name,
        string memory symbol
    ) public initializer {
        _initialize(name, symbol);
        _setRoles(roles);
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    function snapshot()
        public
        virtual
        override
        onlyRole(Roles.RESOLUTION_ROLE)
        returns (uint256)
    {
        return _snapshot();
    }

    function setVoting(
        IVoting voting
    ) external virtual onlyRole(Roles.OPERATOR_ROLE) {
        _setVoting(voting);
    }

    function setShareholderRegistry(
        IShareholderRegistry shareholderRegistry
    ) external virtual onlyRole(Roles.OPERATOR_ROLE) {
        _shareholderRegistry = shareholderRegistry;
    }

    function setSettlementPeriod(
        uint256 settlementPeriod_
    ) external virtual onlyRole(Roles.OPERATOR_ROLE) {
        settlementPeriod = settlementPeriod_;
    }

    function setTokenExternal(
        address tokenExternalAddress
    ) external virtual onlyRole(Roles.OPERATOR_ROLE) {
        _setTokenExternal(tokenExternalAddress);
    }

    function setRedemptionController(
        IRedemptionController redemption
    ) external virtual onlyRole(Roles.OPERATOR_ROLE) {
        _setRedemptionController(redemption);
    }

    function mint(
        address to,
        uint256 amount
    ) public virtual onlyRole(Roles.RESOLUTION_ROLE) {
        _mint(to, amount);
    }

    function burn(
        address from,
        uint256 amount
    ) public virtual onlyRole(Roles.MARKET_ROLE) {
        _burn(from, amount);
    }

    function wrap(
        address from,
        uint256 amount
    ) public virtual onlyRole(Roles.MARKET_ROLE) {
        _wrap(from, amount);
    }

    function unwrap(
        address from,
        address to,
        uint256 amount
    ) public virtual onlyRole(Roles.MARKET_ROLE) {
        _unwrap(from, to, amount);
    }

    function settleTokens(address from) public virtual {
        _settleTokens(from);
    }

    function mintVesting(
        address to,
        uint256 amount
    ) public virtual onlyRole(Roles.RESOLUTION_ROLE) {
        _mintVesting(to, amount);
    }

    function setVesting(
        address to,
        uint256 amount
    ) public virtual onlyRole(Roles.OPERATOR_ROLE) {
        _setVesting(to, amount);
    }

    function transfer(
        address to,
        uint256 amount
    )
        public
        virtual
        override(ERC20Upgradeable, IERC20Upgradeable)
        onlyRole(Roles.MARKET_ROLE)
        returns (bool)
    {
        return super.transfer(to, amount);
    }

    function transferFrom(
        address from,
        address to,
        uint256 amount
    )
        public
        virtual
        override(ERC20Upgradeable, IERC20Upgradeable)
        onlyRole(Roles.MARKET_ROLE)
        returns (bool)
    {
        return super.transferFrom(from, to, amount);
    }

    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        super._afterTokenTransfer(from, to, amount);
        _voting.afterTokenTransfer(from, to, amount);

        if (
            from == address(0) &&
            _shareholderRegistry.isAtLeast(
                _shareholderRegistry.CONTRIBUTOR_STATUS(),
                to
            )
        ) {
            _redemptionController.afterMint(to, amount);
        }

        // Invariants
        require(
            balanceOf(from) >= _vestingBalance[from],
            "GovernanceToken: transfer amount exceeds vesting"
        );
    }

    function settlingBalanceOf(
        address account
    ) public view virtual returns (uint256 amount) {
        for (uint256 i = depositedTokens[account].length; i > 0; i--) {
            DepositedTokens memory tokens = depositedTokens[account][i - 1];
            if (block.timestamp < tokens.settlementTimestamp) {
                if (tokens.amount > 0) {
                    amount += tokens.amount;
                } else {
                    break;
                }
            }
        }
    }

    // Internal

    // These functions have been introduced on a later update. Given the memory layout
    // of our class-tree, we could not use the new storage (settlementPeriod, depositedTokens)
    // on GovernanceTokenBase. They had to be declared on this class, hence the methods could
    // only be implemented here.
    function _wrap(address from, uint amount) internal virtual {
        tokenExternal.transferFrom(from, address(this), amount);
        uint256 settlementTimestamp = block.timestamp + settlementPeriod;
        depositedTokens[from].push(
            DepositedTokens(amount, settlementTimestamp)
        );
        emit DepositStarted(from, amount, settlementTimestamp);
    }

    function _settleTokens(address from) internal virtual {
        for (uint256 i = depositedTokens[from].length; i > 0; i--) {
            DepositedTokens storage tokens = depositedTokens[from][i - 1];
            if (block.timestamp >= tokens.settlementTimestamp) {
                if (tokens.amount > 0) {
                    super._mint(from, tokens.amount);
                    tokens.amount = 0;
                } else {
                    break;
                }
            }
        }
    }
}
