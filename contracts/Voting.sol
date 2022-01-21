// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Voting {
  IERC20 token;

  mapping(address => address) _delegates;
  mapping(address => uint256) _votes;

  function balanceOf(address account) public view returns (uint256) {
    return token.balanceOf(account);
  }

  function afterTokenTransfer(
    address from,
    address to,
    uint256 amount
  ) internal {
    _moveVotingPower(getDelegate(from), getDelegate(to), amount);
  }

  function getDelegate(address account) public view returns (address) {
    address delegatee = _delegates[account];

    return delegatee == address(0) ? account : delegatee;
  }

  function getVotes(address account) public view returns (uint256) {
    uint256 votes = _votes[account];
    return votes == 0 ? balanceOf(account) : votes;
  }

  function delegate(address delegatee) public {
    _delegate(msg.sender, delegatee);
  }

  function _delegate(address delegator, address delegatee) internal {
    _beforeDelegate(delegator, delegatee);

    address currentDelegate = getDelegate(delegator);
    uint256 delegatorBalance = balanceOf(delegator);
    _delegates[delegator] = delegatee;

    //emit DelegateChanged(delegator, currentDelegate, delegatee);

    _moveVotingPower(currentDelegate, delegatee, delegatorBalance);
  }

  function _moveVotingPower(
    address from,
    address to,
    uint256 amount
  ) private {
    if (from != to && amount > 0) {
      if (from != address(0)) {
        uint256 oldVotes = _votes[from];
        _votes[from] = oldVotes - amount;
        //emit DelegateVotesChanged(src, oldVotes, _votes[src]);
      }

      if (to != address(0)) {
        uint256 oldVotes = _votes[to];
        _votes[to] = oldVotes + amount;
        //emit DelegateVotesChanged(dst, oldVotes, _votes[dst]);
      }
    }
  }

  function _beforeDelegate(address delegator, address delegated) internal virtual {}
}
