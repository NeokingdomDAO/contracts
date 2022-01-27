// spdx-license-identifier: mit

pragma solidity ^0.8.0;

contract ResolutionMock {
    event ResolutionCreated(address indexed from, uint256 indexed id);
    event ResolutionUpdated(address indexed from, uint256 indexed id);
    event ResolutionApproved(address indexed from, uint256 indexed id);

    struct ResolutionType {
        string name;
        uint256 quorum;
        uint256 noticePeriod;
        uint256 votingPeriod;
    }

    ResolutionType[] public resolutionTypes;

    struct Resolution {
        string dataURI;
        uint256 approveTimestamp;
        uint256 resolutionTypeId;
    }

    Resolution[] public resolutions;

    constructor() {
        resolutionTypes.push(
            ResolutionType("fundamental", 66, 14 days, 6 days)
        );
        resolutionTypes.push(ResolutionType("significant", 51, 6 days, 4 days));
        resolutionTypes.push(ResolutionType("routine", 51, 3 days, 2 days));
    }

    function approveResolution(uint256 resolutionId) public {
        Resolution storage resolution = resolutions[resolutionId];
        require(
            resolution.approveTimestamp == 0,
            "Resolution: already approved"
        );
        resolution.approveTimestamp = block.timestamp;
        emit ResolutionApproved(msg.sender, resolutionId);
    }

    function createResolution(string calldata dataURI, uint256 resolutionTypeId)
        public
        returns (uint256)
    {
        resolutions.push(Resolution(dataURI, 0, resolutionTypeId));
        emit ResolutionCreated(msg.sender, resolutions.length - 1);
        return resolutions.length - 1;
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
}
