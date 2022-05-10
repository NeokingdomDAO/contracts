// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "../ShareholderRegistry/IShareholderRegistry.sol";
import "../TelediskoToken/ITelediskoToken.sol";
import "../Voting/IVoting.sol";
import "../extensions/Roles.sol";

contract ResolutionManager is Context, AccessControl {
    uint256 private _currentResolutionId = 1;

    event ResolutionCreated(address indexed from, uint256 indexed resolutionId);
    event ResolutionUpdated(address indexed from, uint256 indexed resolutionId);
    event ResolutionApproved(
        address indexed from,
        uint256 indexed resolutionId
    );
    event ResolutionVoted(
        address indexed from,
        uint256 indexed resolutionId,
        uint256 votingPower,
        bool isYes
    );
    event ResolutionTypeCreated(
        address indexed from,
        uint256 indexed typeIndex
    );
    event DelegateLostVotingPower(
        address indexed from,
        uint256 indexed resolutionId,
        uint256 amount
    );

    IShareholderRegistry private _shareholderRegistry;
    ITelediskoToken private _telediskoToken;
    IVoting private _voting;

    // TODO: make resolution type indices more explicit
    struct ResolutionType {
        string name;
        uint256 quorum;
        uint256 noticePeriod;
        uint256 votingPeriod;
        bool canBeNegative;
    }

    ResolutionType[] public resolutionTypes;

    struct Resolution {
        string dataURI;
        uint256 resolutionTypeId;
        uint256 approveTimestamp;
        uint256 snapshotId;
        uint256 yesVotesTotal;
        bool isNegative;
        mapping(address => bool) hasVoted;
        mapping(address => bool) hasVotedYes;
        mapping(address => uint256) lostVotingPower;
    }

    mapping(uint256 => Resolution) public resolutions;

    constructor(
        IShareholderRegistry shareholderRegistry,
        ITelediskoToken telediskoToken,
        IVoting voting
    ) {
        _shareholderRegistry = shareholderRegistry;
        _telediskoToken = telediskoToken;
        _voting = voting;

        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());

        // TODO: check if there are any rounding errors
        _addResolutionType("amendment", 66, 14 days, 6 days, false);
        _addResolutionType("capitalChange", 66, 14 days, 6 days, false);
        _addResolutionType("preclusion", 75, 14 days, 6 days, false);
        _addResolutionType("fundamentalOther", 51, 14 days, 6 days, false);
        _addResolutionType("significant", 51, 6 days, 4 days, false);
        _addResolutionType("dissolution", 66, 14 days, 6 days, false);
        _addResolutionType("routine", 51, 3 days, 2 days, true);
    }

    function addResolutionType(
        string memory name,
        uint256 quorum,
        uint256 noticePeriod,
        uint256 votingPeriod,
        bool canBeNegative
    ) public onlyRole(Roles.OPERATOR_ROLE) {
        _addResolutionType(
            name,
            quorum,
            noticePeriod,
            votingPeriod,
            canBeNegative
        );
    }

    function setShareholderRegistry(IShareholderRegistry shareholderRegistry)
        external
        onlyRole(Roles.OPERATOR_ROLE)
    {
        _shareholderRegistry = shareholderRegistry;
    }

    function setTelediskoToken(ITelediskoToken telediskoToken)
        external
        onlyRole(Roles.OPERATOR_ROLE)
    {
        _telediskoToken = telediskoToken;
    }

    function setVoting(IVoting voting) external onlyRole(Roles.OPERATOR_ROLE) {
        _voting = voting;
    }

    function _snapshotAll() internal returns (uint256) {
        _shareholderRegistry.snapshot();
        _telediskoToken.snapshot();
        return _voting.snapshot();
    }

    function createResolution(
        string calldata dataURI,
        uint256 resolutionTypeId,
        bool isNegative
    ) public returns (uint256) {
        ResolutionType storage resolutionType = resolutionTypes[
            resolutionTypeId
        ];
        require(
            _shareholderRegistry.isAtLeast(
                _shareholderRegistry.CONTRIBUTOR_STATUS(),
                _msgSender()
            ),
            "Resolution: only contributor can create"
        );
        require(
            !isNegative || resolutionType.canBeNegative,
            "Resolution: cannot be negative"
        );
        uint256 resolutionId = _currentResolutionId++;
        Resolution storage resolution = resolutions[resolutionId];

        resolution.dataURI = dataURI;
        resolution.resolutionTypeId = resolutionTypeId;
        resolution.isNegative = isNegative;
        emit ResolutionCreated(_msgSender(), resolutionId);
        return resolutionId;
    }

    function approveResolution(uint256 resolutionId) public {
        require(
            _shareholderRegistry.isAtLeast(
                _shareholderRegistry.MANAGING_BOARD_STATUS(),
                _msgSender()
            ),
            "Resolution: only managing board can approve"
        );
        require(
            resolutionId < _currentResolutionId,
            "Resolution: does not exist"
        );

        Resolution storage resolution = resolutions[resolutionId];
        require(
            resolution.approveTimestamp == 0,
            "Resolution: already approved"
        );
        resolution.approveTimestamp = block.timestamp;
        resolution.snapshotId = _snapshotAll();
        emit ResolutionApproved(_msgSender(), resolutionId);
    }

    function updateResolution(
        uint256 resolutionId,
        string calldata dataURI,
        uint256 resolutionTypeId,
        bool isNegative
    ) public {
        Resolution storage resolution = resolutions[resolutionId];
        require(
            resolution.approveTimestamp == 0,
            "Resolution: already approved"
        );

        require(
            _shareholderRegistry.isAtLeast(
                _shareholderRegistry.MANAGING_BOARD_STATUS(),
                _msgSender()
            ),
            "Resolution: only managing board can update"
        );

        ResolutionType storage resolutionType = resolutionTypes[
            resolutionTypeId
        ];
        require(
            !isNegative || resolutionType.canBeNegative,
            "Resolution: cannot be negative"
        );

        resolution.dataURI = dataURI;
        resolution.resolutionTypeId = resolutionTypeId;
        resolution.isNegative = isNegative;
        emit ResolutionUpdated(_msgSender(), resolutionId);
    }

    function getVoterVote(uint256 resolutionId, address voter)
        public
        view
        returns (
            bool isYes,
            bool hasVoted,
            uint256 votingPower
        )
    {
        Resolution storage resolution = resolutions[resolutionId];
        require(
            _voting.canVoteAt(voter, resolution.snapshotId),
            "Resolution: account could not vote resolution"
        );

        isYes = resolution.hasVotedYes[voter];
        hasVoted = resolution.hasVoted[voter];

        if (
            _voting.getDelegateAt(voter, resolution.snapshotId) != voter &&
            hasVoted
        ) {
            votingPower = _telediskoToken.balanceOfAt(
                voter,
                resolution.snapshotId
            );
        } else {
            votingPower =
                _voting.getVotingPowerAt(voter, resolution.snapshotId) -
                resolution.lostVotingPower[voter];
        }
    }

    function getResolutionResult(uint256 resolutionId)
        public
        view
        returns (bool)
    {
        Resolution storage resolution = resolutions[resolutionId];
        ResolutionType storage resolutionType = resolutionTypes[
            resolution.resolutionTypeId
        ];
        uint256 totalVotingPower = _voting.getTotalVotingPowerAt(
            resolution.snapshotId
        );

        bool hasQuorum = resolution.yesVotesTotal * 100 >=
            resolutionType.quorum * totalVotingPower;

        return resolution.isNegative ? !hasQuorum : hasQuorum;
    }

    function vote(uint256 resolutionId, bool isYes) public {
        Resolution storage resolution = resolutions[resolutionId];
        require(
            _voting.canVoteAt(_msgSender(), resolution.snapshotId),
            "Resolution: account cannot vote"
        );

        ResolutionType storage resolutionType = resolutionTypes[
            resolution.resolutionTypeId
        ];
        require(
            isYes != resolution.hasVotedYes[_msgSender()] ||
                !resolution.hasVoted[_msgSender()],
            "Resolution: can't repeat same vote"
        );
        require(resolution.approveTimestamp > 0, "Resolution: not approved");

        uint256 votingStart = resolution.approveTimestamp +
            resolutionType.noticePeriod;
        uint256 votingEnd = votingStart + resolutionType.votingPeriod;

        require(
            block.timestamp >= votingStart && block.timestamp < votingEnd,
            "Resolution: not votable"
        );

        uint256 votingPower = _voting.getVotingPowerAt(
            _msgSender(),
            resolution.snapshotId
        );
        address delegate = _voting.getDelegateAt(
            _msgSender(),
            resolution.snapshotId
        );

        // If sender has a delegate load voting power from TelediskoToken
        if (delegate != _msgSender()) {
            votingPower = _telediskoToken.balanceOfAt(
                _msgSender(),
                resolution.snapshotId
            );
            // If sender didn't vote before and has a delegate
            //if (!resolution.hasVoted[_msgSender()]) {
            // Did sender's delegate vote?
            if (
                resolution.hasVoted[delegate] &&
                resolution.hasVotedYes[delegate]
            ) {
                resolution.yesVotesTotal -= votingPower;
            }
            resolution.lostVotingPower[delegate] += votingPower;
            emit DelegateLostVotingPower(delegate, resolutionId, votingPower);
            //}
        }

        // votingPower is set
        // delegate vote has been cleared
        votingPower -= resolution.lostVotingPower[_msgSender()];

        if (isYes && !resolution.hasVotedYes[_msgSender()]) {
            // If sender votes yes and hasn't voted yes before
            resolution.yesVotesTotal += votingPower;
        } else if (resolution.hasVotedYes[_msgSender()]) {
            // If sender votes no and voted yes before
            resolution.yesVotesTotal -= votingPower;
        }

        emit ResolutionVoted(_msgSender(), resolutionId, votingPower, isYes);

        resolution.hasVoted[_msgSender()] = true;
        resolution.hasVotedYes[_msgSender()] = isYes;
    }

    function _addResolutionType(
        string memory name,
        uint256 quorum,
        uint256 noticePeriod,
        uint256 votingPeriod,
        bool canBeNegative
    ) internal {
        resolutionTypes.push(
            ResolutionType(
                name,
                quorum,
                noticePeriod,
                votingPeriod,
                canBeNegative
            )
        );

        emit ResolutionTypeCreated(_msgSender(), resolutionTypes.length - 1);
    }
}
