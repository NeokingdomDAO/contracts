// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Arrays.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./extensions/Snapshottable.sol";
import "./Voting.sol";

contract VotingSnapshot is Voting, Snapshottable {
  using Arrays for uint256[];

  struct Snapshots {
    uint256[] ids;
    uint256[] votes;
    address[] delegates;
  }

  mapping(address => Snapshots) _delegationSnapshots;

  function snapshot() public virtual override returns (uint256) {
    return _snapshot();
  }

  function getDelegateAt(address account, uint256 snapshotId)
    public
    view
    returns (address)
  {
    Snapshots storage snapshots = _delegationSnapshots[account];
    (bool valid, uint256 index) = _indexAt(snapshotId, snapshots.ids);

    return valid ? snapshots.delegates[index] : _delegates[account];
  }

  function getVotesAt(address account, uint256 snapshotId)
    public
    view
    returns (uint256)
  {
    Snapshots storage snapshots = _delegationSnapshots[account];
    (bool valid, uint256 index) = _indexAt(snapshotId, snapshots.ids);

    return valid ? snapshots.votes[index] : getVotes(account);
  }

  function _updateSnapshot(
    Snapshots storage snapshots,
    address currentDelegate,
    uint256 currentVotes
  ) private {
    uint256 currentId = _getCurrentSnapshotId();
    if (_lastSnapshotId(snapshots.ids) < currentId) {
      snapshots.ids.push(currentId);
      snapshots.delegates.push(currentDelegate);
      snapshots.votes.push(currentVotes);
    }
  }

  function _beforeDelegate(address delegator, address delegate)
    internal
    override
  {
    _updateSnapshot(
      _delegationSnapshots[delegator],
      delegator,
      getVotes(delegator)
    );
    _updateSnapshot(
      _delegationSnapshots[delegate],
      delegate,
      getVotes(delegate)
    );
  }
}
