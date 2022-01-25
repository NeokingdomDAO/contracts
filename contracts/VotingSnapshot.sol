// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Arrays.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./extensions/Snapshottable.sol";
import "./Voting.sol";

contract VotingSnapshot is Voting, Snapshottable {
    using Arrays for uint256[];

    struct SnapshotsDelegates {
        uint256[] ids;
        address[] delegates;
    }

    struct SnapshotsValues {
        uint256[] ids;
        uint256[] values;
    }

    mapping(address => SnapshotsDelegates) _delegationSnapshots;
    mapping(address => SnapshotsValues) _votesSnapshots;
    SnapshotsValues private _votingPowerSnapshots;

    function snapshot() public virtual override returns (uint256) {
        return _snapshot();
    }

    function getDelegateAt(address account, uint256 snapshotId)
        public
        view
        returns (address)
    {
        SnapshotsDelegates storage snapshots = _delegationSnapshots[account];
        (bool valid, uint256 index) = _indexAt(snapshotId, snapshots.ids);

        return valid ? snapshots.delegates[index] : getDelegate(account);
    }

    function getVotesAt(address account, uint256 snapshotId)
        public
        view
        returns (uint256)
    {
        SnapshotsValues storage snapshots = _votesSnapshots[account];
        (bool valid, uint256 index) = _indexAt(snapshotId, snapshots.ids);

        return valid ? snapshots.values[index] : getVotes(account);
    }

    function getTotalVotingPowerAt(uint256 snapshotId)
        public
        view
        returns (uint256)
    {
        (bool valid, uint256 index) = _indexAt(
            snapshotId,
            _votingPowerSnapshots.ids
        );

        return
            valid ? _votingPowerSnapshots.values[index] : getTotalVotingPower();
    }

    /*
     * Snapshots update logic
     */

    function _updateSnaphshotDelegation(
        SnapshotsDelegates storage snapshots,
        address currentDelegate
    ) private {
        uint256 currentId = getCurrentSnapshotId();
        if (_lastSnapshotId(snapshots.ids) < currentId) {
            snapshots.ids.push(currentId);
            snapshots.delegates.push(currentDelegate);
        }
    }

    function _updateSnaphshotValues(
        SnapshotsValues storage snapshots,
        uint256 currentValue
    ) private {
        uint256 currentId = getCurrentSnapshotId();
        if (_lastSnapshotId(snapshots.ids) < currentId) {
            snapshots.ids.push(currentId);
            snapshots.values.push(currentValue);
        }
    }

    /*
     * Callbacks
     */

    function _beforeDelegate(address delegator) internal override {
        super._beforeDelegate(delegator);
        _updateSnaphshotDelegation(
            _delegationSnapshots[delegator],
            getDelegate(delegator)
        );
    }

    function _beforeMoveVotingPower(address account) internal override {
        super._beforeMoveVotingPower(account);
        _updateSnaphshotValues(_votesSnapshots[account], getVotes(account));
    }

    function _beforeUpdateTotalVotingPower() internal override {
        super._beforeUpdateTotalVotingPower();
        _updateSnaphshotValues(_votingPowerSnapshots, getTotalVotingPower());
    }
}
