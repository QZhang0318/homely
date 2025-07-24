from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import pandas as pd
import re
import shap

# Load model components
model = joblib.load("models/xgb_model_0713.pkl")
preprocessor = joblib.load("models/xgb_model_0713_preprocessor.pkl")
explainer = joblib.load("models/xgb_model_0713_explainer.pkl")

app = Flask(__name__)
CORS(app)
@app.route("/")
def home():
    return "<h1>🏠 Welcome to Homely</h1><p>Your backend is up and running.</p>"

# Define feature structure
categorical_cols = ['City Tax Rate Area', 'Roll Year', 'Property Use Type', 'Zip Code.1', 'Year Built', 'Effective Year']
numerical_cols = ['Number of Buildings', 'Square Footage', 'Number of Bedrooms', 'Number of Bathrooms',
                  'Number of Units', 'num_nearby_arts_and_rec', 'num_nearby_fire_stations', 'num_nearby_hospitals',
                  'num_nearby_physical_features', 'num_nearby_transportation', 'num_nearby_schools']
all_features = categorical_cols + numerical_cols

# SHAP helper function
def get_shap_values_for_prediction(model_input, preprocessor, explainer):
    df_preprocessed = preprocessor.transform(model_input)
    shap_values = explainer(df_preprocessed)
    feature_names = preprocessor.get_feature_names_out()

    # Clean prefixes
    clean_feature_names = [re.sub(r'^(num__|cat__|geo__)', '', name) for name in feature_names]

    # Create dictionary
    shap_dict = dict(zip(clean_feature_names, shap_values.values[0]))
    sorted_shap_values = dict(sorted(
        ((k, round(float(v), 2)) for k, v in shap_dict.items()),
        key=lambda item: abs(item[1]),
        reverse=True
    ))

    # Return top 10 as list of dicts
    return [{"feature": k, "shap_value": v} for k, v in list(sorted_shap_values.items())[:10]]

# Flask endpoint
@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.json
        print("Received JSON:", data)

        df_input = pd.DataFrame([data])[all_features]
        print("DF input:\n", df_input)

        # Predict
        X_processed = preprocessor.transform(df_input)
        prediction = model.predict(X_processed)[0]
        print("Prediction:", prediction)

        # SHAP summary
        shap_summary = get_shap_values_for_prediction(df_input, preprocessor, explainer)

        return jsonify({
            "what_if_value": float(round(prediction, 2)),
            "shap_summary": shap_summary
        })

    except Exception as e:
        print("Error:", e)
        return jsonify({"error": str(e)}), 400

if __name__ == "__main__":
    app.run(debug=True)
