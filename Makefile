.PHONY: sdm up

# Run the Indian Elephant Correlative Species Distribution Model (SDM)
sdm:
	./run_sdm.sh

# Run the local Flask web dashboard
up:
	python3 app.py
