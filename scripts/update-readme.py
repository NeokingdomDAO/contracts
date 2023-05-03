import json
import argparse


def load_json(file_name):
    with open(file_name, "r") as file:
        data = json.load(file)
    return data


def transform_to_output_format(json_data):
    output = []
    for key in json_data:
        address = json_data[key]["address"]
        output.append(f"- [{key}](https://escan.live/address/{address}) `{address}`")
    return "\n".join(output)


def main():
    parser = argparse.ArgumentParser(
        description="Transform a network JSON file to markdown"
    )
    parser.add_argument("file_name", help="Path to the JSON file")
    args = parser.parse_args()

    json_data = load_json(args.file_name)
    formatted_output = transform_to_output_format(json_data)
    print(formatted_output)


if __name__ == "__main__":
    main()
