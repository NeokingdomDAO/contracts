// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "./GovernanceTokenSnapshot.sol";

/**
 * @title GovernanceToken
 * @notice This contract represents the main governance token based on the ERC20 standard and extends functionality
 * with snapshot, vesting, deposit, and wrap features.
 * @dev This contract supports basic ERC20 transfer functionalities, and has additional
 * functionality for voting, minting, burning, wrapping/unwrapping, and settling tokens. Only authorized
 * roles (as defined in DAORoles contract) can call certain functions such as mint, burn, wrap, unwrap, and others.
 */
contract GovernanceToken is Initializable, GovernanceTokenSnapshot {
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

    /**
     * @notice Initializes a new GovernanceToken instance with the provided roles, name, and symbol.
     * @dev Sets the roles, ERC20 name and symbol using provided args and calls the internal `_initialize` function.
     * @param daoRegistry DAORegistry instance that controls roles within the token contract.
     * @param name string for the ERC20 token name of GovernanceToken.
     * @param symbol string for the ERC20 token symbol of GovernanceToken.
     */
    function initialize(
        DAORegistry daoRegistry,
        string memory name,
        string memory symbol
    ) public initializer {
        _setDAORegistry(daoRegistry);
        _initialize(name, symbol);
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    modifier zeroCheck(address address_) {
        require(address_ != address(0), "GovernanceToken: 0x0 not allowed");
        _;
    }

    /**
     * @notice Creates a snapshot of the current GovernanceToken state.
     * @dev Snapshots can only be created by the role having resolution privileges.
     * @return uint256 A snapshot ID.
     */
    function snapshot()
        public
        virtual
        override
        onlyResolutionManager
        returns (uint256)
    {
        return _snapshot();
    }

    /**
     * @notice Set the settlement period for token deposits.
     * @dev Can be called only by the operator role.
     * @param settlementPeriod_ uint256 representing the settlement period in seconds.
     */
    function setSettlementPeriod(
        uint256 settlementPeriod_
    ) external virtual onlyResolutionManager {
        settlementPeriod = settlementPeriod_;
    }

    /**
     * @notice Mint new governance tokens for the given address.
     * @dev Can be called only by the resolution role.
     * @param to Address of the user to receive minted tokens.
     * @param amount Amount of tokens to be minted.
     */
    function mint(
        address to,
        uint256 amount
    ) public virtual onlyResolutionManager {
        _mint(to, amount);

        if (
            _shareholderRegistry.isAtLeast(
                _shareholderRegistry.CONTRIBUTOR_STATUS(),
                to
            )
        ) {
            getRedemptionController().afterMint(to, amount);
        }
    }

    /**
     * @notice Burn tokens from the given address.
     * @dev Can be called only by the market role.
     * @param from Address of the user from which tokens will be burned.
     * @param amount Amount of tokens to be burned.
     */
    function burn(
        address from,
        uint256 amount
    ) public virtual onlyInternalMarket {
        _burn(from, amount);
    }

    /**
     * @notice Wrap external tokens into GovernanceTokens and deposit them.
     * @dev Can be called only by the market role.
     * @param from Address of the user to wrap tokens.
     * @param amount Amount of tokens to be wrapped.
     */
    function wrap(
        address from,
        uint256 amount
    ) public virtual onlyInternalMarket {
        _wrap(from, amount);
    }

    /**
     * @notice Unwrap governance tokens into external tokens.
     * @dev Can be called only by the market role.
     * @param from Address of the user to unwrap tokens.
     * @param to Address to receive the released external tokens.
     * @param amount Amount of tokens to be unwrapped.
     */
    function unwrap(
        address from,
        address to,
        uint256 amount
    ) public virtual onlyInternalMarket {
        _unwrap(from, to, amount);
    }

    /**
     * @notice Settle tokens for a given address.
     * @dev Can be called publicly for any address.
     * @param from Address of the user to settle tokens.
     */
    function settleTokens(address from) public virtual {
        _settleTokens(from);
    }

    /**
     * @notice Mint vesting tokens for a given address.
     * @dev Can be called only by the resolution role.
     * @param to Address of the user to receive minted tokens.
     * @param amount Amount of vested tokens to be minted.
     */
    function mintVesting(
        address to,
        uint256 amount
    ) public virtual onlyResolutionManager {
        _mintVesting(to, amount);
    }

    /**
     * @notice Set vesting balance for a given address.
     * @dev Can be called only by the operator role.
     * @param to Address of the user to set vesting balance.
     * @param amount Amount of tokens to be set as vesting balance for the user.
     */
    function setVesting(
        address to,
        uint256 amount
    ) public virtual onlyResolutionManager {
        _setVesting(to, amount);
    }

    /**
     * @notice Transfer tokens to a specified address.
     * @dev Override for the ERC20.transfer function. Ensures that only market role can perform transfers.
     * @param to The address to transfer tokens to.
     * @param amount The number of tokens to be transferred.
     * @return A boolean value indicating whether the operation succeeded.
     */
    function transfer(
        address to,
        uint256 amount
    )
        public
        virtual
        override(ERC20Upgradeable, IERC20Upgradeable)
        onlyInternalMarket
        returns (bool)
    {
        return super.transfer(to, amount);
    }

    /**
     * @notice Transfer tokens from one address to another.
     * @dev Override for the ERC20.transferFrom function. Ensures that only market role can perform transfers.
     * @param from Address to transfer tokens from.
     * @param to Address to transfer tokens to.
     * @param amount The number of tokens to be transferred.
     * @return A boolean value indicating whether the operation succeeded.
     */
    function transferFrom(
        address from,
        address to,
        uint256 amount
    )
        public
        virtual
        override(ERC20Upgradeable, IERC20Upgradeable)
        onlyInternalMarket
        returns (bool)
    {
        return super.transferFrom(from, to, amount);
    }

    /**
     * @notice Handle additional actions and validations after a token transfer.
     * This function communicates a) to the voting contract whenever there is a
     * change in balance of a voter; and b) to the redemption controller to keep
     * track of the amount of tokens that can be sold back to the DAO.
     * @dev Called internally by ERC20 transfer, transferFrom, and mint functions.
     * @param from Address from which tokens are transferred.
     * @param to Address to which tokens are transferred.
     * @param amount Amount of tokens being transferred.
     */
    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        super._afterTokenTransfer(from, to, amount);
        getVoting().afterTokenTransfer(from, to, amount);

        // Invariants
        require(
            balanceOf(from) >= _vestingBalance[from],
            "GovernanceToken: transfer amount exceeds vesting"
        );
    }

    /**
     * @notice Get the total amount of tokens set to be settled for the specified account.
     * @param account The address to query the settling balance.
     * @return amount Total amount of tokens to be settled.
     */
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
    // Note: these functions have been introduced on a later update. Given the memory layout
    // of our class-tree, we could not use the new storage (settlementPeriod, depositedTokens)
    // on GovernanceTokenBase. They had to be declared on this class, hence the methods could
    // only be implemented here.

    /**
     * @dev Wrap tokens from an external token balance at a given address and
     * deposit them for settlement.
     * @param from Address from which tokens will be wrapped.
     * @param amount Amount of external tokens to wrap.
     */
    function _wrap(address from, uint amount) internal virtual {
        require(
            getNeokingdomToken().transferFrom(from, address(this), amount),
            "GovernanceToken: transfer failed"
        );
        require(amount > 0, "GovernanceToken: attempt to wrap 0 tokens");

        uint256 settlementTimestamp = block.timestamp + settlementPeriod;
        depositedTokens[from].push(
            DepositedTokens(amount, settlementTimestamp)
        );
        emit DepositStarted(from, amount, settlementTimestamp);
    }

    /**
     * @dev Settle tokens for the specified address by minting GovernanceTokens
     * equivalent to the settled deposited tokens.
     * @param from Address for which tokens will be settled.
     */
    function _settleTokens(address from) internal virtual {
        for (uint256 i = depositedTokens[from].length; i > 0; i--) {
            DepositedTokens storage tokens = depositedTokens[from][i - 1];
            if (block.timestamp >= tokens.settlementTimestamp) {
                if (tokens.amount > 0) {
                    ERC20Upgradeable._mint(from, tokens.amount);
                    tokens.amount = 0;
                } else {
                    break;
                }
            }
        }
    }
}
