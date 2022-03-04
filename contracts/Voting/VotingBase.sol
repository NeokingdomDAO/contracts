// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "../ShareholderRegistry/IShareholderRegistry.sol";
import "./IVoting.sol";

contract VotingBase is Context {
    IShareholderRegistry _shareholderRegistry;
    IERC20 _token;

    bytes32 private _contributorRole;

    // TODO Turn into struct
    mapping(address => address) _delegates;
    mapping(address => uint256) _votingPower;
    mapping(address => uint256) _delegators;

    uint256 _totalVotingPower;

    event DelegateChanged(
        address indexed delegator,
        address currentDelegate,
        address newDelegate
    );
    event DelegateVotesChanged(
        address indexed account,
        uint256 oldVotingPower,
        uint256 newVotingPower
    );

    constructor() {}

    modifier onlyToken() {
        require(
            _msgSender() == address(_token),
            "Voting: only Token contract can call this method."
        );
        _;
    }

    function canVote(address account) public view returns (bool) {
        return getDelegate(account) != address(0);
    }

    function _setToken(IERC20 token) internal {
        _token = token;
    }

    function _setShareholderRegistry(IShareholderRegistry shareholderRegistry)
        internal
    {
        _shareholderRegistry = shareholderRegistry;
        _contributorRole = _shareholderRegistry.CONTRIBUTOR_STATUS();
    }

    function _beforeRemoveContributor(address account) internal {
        address delegated = getDelegate(account);
        if (delegated != address(0)) {
            if (delegated == account) {
                _beforeDelegate(account);
            } else {
                _delegate(account, account);
            }

            delete _delegates[account];

            uint256 individualVotingPower = _token.balanceOf(account);
            if (individualVotingPower > 0) {
                _moveVotingPower(account, address(0), individualVotingPower);
            }
        }
    }

    /// @dev Hook to be called by the companion token upon token transfer
    /// @notice Only the companion token can call this method
    /// @notice The voting power transfer logic relies on the correct usage of this hook from the companion token
    /// @param from The sender's address
    /// @param to The receiver's address
    /// @param amount The amount sent
    function afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) external onlyToken {
        _moveVotingPower(getDelegate(from), getDelegate(to), amount);
    }

    /// @dev Returns the account's current delegate
    /// @param account The account whose delegate is requested
    /// @return Account's voting power
    function getDelegate(address account) public view returns (address) {
        return _delegates[account];
    }

    /// @dev Returns the amount of valid votes for a given address
    /// @notice An address that is not a contributor, will have always 0 voting power
    /// @notice An address that has not delegated at least itself, will have always 0 voting power
    /// @param account The account whose voting power is requested
    /// @return Account's voting power
    function getVotingPower(address account) public view returns (uint256) {
        return _votingPower[account];
    }

    /// @dev Returns the total amount of valid votes
    /// @notice It's the sum of all tokens owned by contributors who has been at least delegated to themselves
    /// @return Total voting power
    function getTotalVotingPower() public view returns (uint256) {
        return _totalVotingPower;
    }

    /// @dev Allows sender to delegate another address for voting
    /// @notice The first address to be delegated must be the sender itself
    /// @notice Sub-delegation is not allowed
    /// @param newDelegate Destination address of module transaction.
    function delegate(address newDelegate) public {
        _delegate(_msgSender(), newDelegate);
    }

    function _delegate(address delegator, address newDelegate) internal {
        address currentDelegate = getDelegate(delegator);
        address newDelegateDelegate = getDelegate(newDelegate);
        uint256 countDelegatorDelegators = _delegators[delegator];

        // pre conditions
        // - participants are contributors
        require(
            _shareholderRegistry.isAtLeast(_contributorRole, delegator),
            "Voting: only contributors can delegate."
        );
        require(
            _shareholderRegistry.isAtLeast(_contributorRole, newDelegate),
            "Voting: only contributors can be delegated."
        );
        // - no sub delegation allowed
        require(
            newDelegate == newDelegateDelegate || delegator == newDelegate,
            "Voting: new delegate is not self delegated"
        );
        require(
            countDelegatorDelegators == 0 || delegator == newDelegate,
            "Voting: delegator is already delegated"
        );

        // - first delegate should be self
        require(
            (currentDelegate == address(0) && delegator == newDelegate) ||
                currentDelegate != address(0),
            "Voting: first delegate should be self"
        );

        // - cannot delegate 0
        require(newDelegate != address(0), "Voting: cannot delegate address 0");

        // - no double delegation
        require(
            newDelegate != currentDelegate,
            "Voting: new delegate equal to old delegate"
        );

        _beforeDelegate(delegator);

        uint256 delegatorBalance = _token.balanceOf(delegator);
        _delegates[delegator] = newDelegate;

        if (delegator != newDelegate && newDelegate != address(0)) {
            _delegators[newDelegate]++;
        }

        if (delegator != currentDelegate && currentDelegate != address(0)) {
            _delegators[currentDelegate]--;
        }

        emit DelegateChanged(delegator, currentDelegate, newDelegate);

        _moveVotingPower(currentDelegate, newDelegate, delegatorBalance);
    }

    function _moveVotingPower(
        address from,
        address to,
        uint256 amount
    ) private {
        if (from != to && amount > 0) {
            if (from != address(0)) {
                _beforeMoveVotingPower(from);
                uint256 oldVotingPower = _votingPower[from];
                _votingPower[from] = oldVotingPower - amount;
                emit DelegateVotesChanged(
                    from,
                    oldVotingPower,
                    _votingPower[from]
                );
            } else {
                _beforeUpdateTotalVotingPower();
                _totalVotingPower += amount;
            }

            if (to != address(0)) {
                _beforeMoveVotingPower(to);
                uint256 oldVotingPower = _votingPower[to];
                _votingPower[to] = oldVotingPower + amount;
                emit DelegateVotesChanged(to, oldVotingPower, _votingPower[to]);
            } else {
                _beforeUpdateTotalVotingPower();
                _totalVotingPower -= amount;
            }
        }
    }

    function _beforeDelegate(address delegator) internal virtual {}

    function _beforeMoveVotingPower(address account) internal virtual {}

    function _beforeUpdateTotalVotingPower() internal virtual {}
}
