// spdx-license-identifier: mit

pragma solidity ^0.8.0;

import "../ShareholderRegistry/IShareholderRegistry.sol";
import "../TelediskoToken/ITelediskoToken.sol";
import "../Voting/IVoting.sol";

contract ResolutionManager {
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
    event DelegateLostVotingPower(
        address indexed from,
        uint256 indexed resolutionId,
        uint256 amount
    );

    IShareholderRegistry private _shareholderRegistry;
    ITelediskoToken private _telediskoToken;
    IVoting private _voting;

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
        bool isPreDraft;
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

        // TODO: check if there are any rounding errors
        resolutionTypes.push(
            ResolutionType("amendment", 66, 14 days, 6 days, false)
        );
        resolutionTypes.push(
            ResolutionType("capitalChange", 66, 14 days, 6 days, false)
        );
        resolutionTypes.push(
            ResolutionType("preclusion", 75, 14 days, 6 days, false)
        );
        resolutionTypes.push(
            ResolutionType("dissolution", 66, 14 days, 6 days, false)
        );
        resolutionTypes.push(
            ResolutionType("fundamentalOther", 51, 14 days, 6 days, false)
        );
        resolutionTypes.push(
            ResolutionType("significant", 51, 6 days, 4 days, false)
        );
        resolutionTypes.push(
            ResolutionType("routine", 51, 3 days, 2 days, true)
        );
    }

    function setShareholderRegistry(IShareholderRegistry shareholderRegistry)
        public
    {
        _shareholderRegistry = shareholderRegistry;
    }

    function setTelediskoToken(ITelediskoToken telediskoToken) public {
        _telediskoToken = telediskoToken;
    }

    function setVoting(IVoting voting) public {
        _voting = voting;
    }

    function snapshotAll() public returns (uint256) {
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
            !isNegative || resolutionType.canBeNegative,
            "Resolution: cannot be negative"
        );

        // FIXME: timestamp is unique but only in the block
        Resolution storage resolution = resolutions[block.timestamp];
        resolution.dataURI = dataURI;
        resolution.resolutionTypeId = resolutionTypeId;
        resolution.isNegative = isNegative;
        resolution.isPreDraft = true;
        emit ResolutionCreated(msg.sender, block.timestamp);
        return block.timestamp;
    }

    function approveResolution(uint256 resolutionId) public {
        Resolution storage resolution = resolutions[resolutionId];
        require(resolution.isPreDraft, "Resolution: does not exist");
        require(
            resolution.approveTimestamp == 0,
            "Resolution: already approved"
        );
        resolution.approveTimestamp = block.timestamp;
        resolution.snapshotId = snapshotAll();
        resolution.isPreDraft = false;
        emit ResolutionApproved(msg.sender, resolutionId);
    }

    function updateResolution(
        uint256 resolutionId,
        string calldata dataURI,
        uint256 resolutionTypeId
    ) public {
        Resolution storage resolution = resolutions[resolutionId];
        require(
            resolution.approveTimestamp == 0,
            "Resolution: already approved"
        );
        resolution.dataURI = dataURI;
        resolution.resolutionTypeId = resolutionTypeId;
        emit ResolutionUpdated(msg.sender, resolutionId);
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

        isYes = resolution.hasVotedYes[voter];
        hasVoted = resolution.hasVoted[voter];

        if (
            _voting.getDelegateAt(voter, resolution.snapshotId) != address(0) &&
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

    /*
    function getResolution(uint256 resolutionId)
        public
        view
        returns (
            Resolution memory resolution,
            uint256 votingStart,
            uint256 votingEnd,
            string memory status
        )
    {
        resolution = resolutions[resolutionId];
        ResolutionType storage resolutionType = resolutionTypes[
            resolution.resolutionTypeId
        ];

        if (resolution.approveTimestamp > 0) {
            votingStart =
                resolution.approveTimestamp +
                resolutionType.noticePeriod;
            votingEnd = votingStart + resolutionType.votingPeriod;
        }

        if (resolution.approveTimestamp == 0) {
            status = "not approved";
        } else if (block.timestamp < votingStart) {
            status = "notice";
        } else if (block.timestamp < votingEnd) {
            status = "voting";
        } else {
            // Should be yes/no
            status = "resolved";
        }
    }
    */

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
        bool hasQuorum = resolution.yesVotesTotal >=
            resolutionType.quorum * totalVotingPower;
        return resolution.isNegative ? !hasQuorum : hasQuorum;
    }

    function vote(uint256 resolutionId, bool isYes) public {
        Resolution storage resolution = resolutions[resolutionId];
        ResolutionType storage resolutionType = resolutionTypes[
            resolution.resolutionTypeId
        ];
        require(
            isYes != resolution.hasVotedYes[msg.sender] ||
                !resolution.hasVoted[msg.sender],
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
            msg.sender,
            resolution.snapshotId
        );
        address delegate = _voting.getDelegateAt(
            msg.sender,
            resolution.snapshotId
        );

        // If sender has a delegate load voting power from TelediskoToken
        if (delegate != address(0)) {
            votingPower = _telediskoToken.balanceOfAt(
                msg.sender,
                resolution.snapshotId
            );
            // If sender didn't vote before and has a delegate
            if (!resolution.hasVoted[msg.sender]) {
                // Did sender's delegate vote?
                if (
                    resolution.hasVoted[delegate] &&
                    resolution.hasVotedYes[delegate]
                ) {
                    resolution.yesVotesTotal -= votingPower;
                }
                resolution.lostVotingPower[delegate] += votingPower;
                emit DelegateLostVotingPower(
                    delegate,
                    resolutionId,
                    votingPower
                );
            }
        }

        // votingPower is set
        // delegate vote has been cleared
        votingPower -= resolution.lostVotingPower[msg.sender];

        if (isYes && !resolution.hasVotedYes[msg.sender]) {
            // If sender votes yes and hasn't voted yes before
            resolution.yesVotesTotal += votingPower;
        } else if (resolution.hasVotedYes[msg.sender]) {
            // If sender votes no and voted yes before
            resolution.yesVotesTotal -= votingPower;
        }

        emit ResolutionVoted(msg.sender, resolutionId, votingPower, isYes);

        resolution.hasVoted[msg.sender] = true;
        resolution.hasVotedYes[msg.sender] = isYes;
    }
}
