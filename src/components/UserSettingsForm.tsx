import React from "react";
import { styled } from "@mui/material/styles";
import { TextField, Button, Grid } from "@mui/material";
import { Formik, Form, Field, FieldProps } from "formik";
import { string, object, mixed } from "yup";
import { User, DefaultPrivacyLevel, UserSettingsPayload } from "../models";

const PREFIX = "UserSettingsForm";

const classes = {
  paper: `${PREFIX}-paper`,
  form: `${PREFIX}-form`,
};

const StyledFormik = styled(Formik)(({ theme }) => ({
  [`& .${classes.paper}`]: {
    marginTop: theme.spacing(8),
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
}));

const MarginHonoringDiv = styled("div")(({ theme }) => ({
  width: "100%", // Fix IE 11 issue.
  marginTop: theme.spacing(1),
}));

// A phone number is ten digits and nothing else. The one expression says all of it: the
// charset is digits plus space, dot, dash and parentheses; a digit may be followed by at
// most one separator, and only when a digit follows it - so no separator at either end and
// never two in a row. "615-555-1212" passes; "6155551212-", "(1234567890", "1234567890)"
// and "615--555-1212" do not. backend/validators.ts's isPhoneNumber is the same rule written
// as a scan, for PATCH /users/:userId.
const phoneRegExp = /^(?=[\d -.()]*$)(?:\d|(?<=\d)[-. ()](?=\d))+$/;
const tenDigits = (value: string) => (value.match(/\d/g) ?? []).length === 10;
// The rules reject anything well before these lengths - isEmail caps an address at 254
// characters and ten digits need at most 19 - so they only bound how much text is scanned,
// on every keystroke here and per request on the API.
const MAX_PHONE_LENGTH = 32;
const MAX_EMAIL_LENGTH = 254;

const DefaultPrivacyLevelValues = Object.values(DefaultPrivacyLevel);

const validationSchema = object({
  firstName: string().required("Enter a first name"),
  lastName: string().required("Enter a last name"),
  email: string()
    .trim()
    .required("Enter an email address")
    .max(MAX_EMAIL_LENGTH, "Must contain a valid email address")
    .email("Must contain a valid email address"),
  phoneNumber: string()
    .trim()
    .required("Enter a phone number")
    .max(MAX_PHONE_LENGTH, "Phone number is not valid")
    .matches(phoneRegExp, "Phone number is not valid")
    .test("ten-digits", "Phone number is not valid", (value) => tenDigits(value ?? "")),
  defaultPrivacyLevel: mixed<DefaultPrivacyLevel>().oneOf(DefaultPrivacyLevelValues),
});

export interface UserSettingsProps {
  userProfile: User;
  updateUser: Function;
}

const UserSettingsForm: React.FC<UserSettingsProps> = ({ userProfile, updateUser }) => {
  const initialValues: UserSettingsPayload = {
    firstName: userProfile.firstName,
    lastName: userProfile.lastName,
    email: userProfile.email,
    phoneNumber: userProfile.phoneNumber,
    defaultPrivacyLevel: userProfile.defaultPrivacyLevel,
  };

  return (
    <StyledFormik
      initialValues={initialValues}
      validationSchema={validationSchema}
      onSubmit={(values, { setSubmitting }) => {
        setSubmitting(true);
        updateUser({ id: userProfile.id, ...values });
        setSubmitting(false);
      }}
    >
      {({ isValid, isSubmitting }) => (
        <MarginHonoringDiv>
          <Form data-test="user-settings-form">
            <Field name="firstName">
              {({ field, meta: { error, value, initialValue, touched } }: FieldProps) => (
                <TextField
                  variant="outlined"
                  margin="dense"
                  fullWidth
                  required
                  id={"user-settings-firstName-input"}
                  type="text"
                  placeholder="First Name"
                  inputProps={{ "data-test": "user-settings-firstName-input" }}
                  error={(touched || value !== initialValue) && Boolean(error)}
                  helperText={touched || value !== initialValue ? error : ""}
                  {...field}
                />
              )}
            </Field>
            <Field name="lastName">
              {({ field, meta: { error, value, initialValue, touched } }: FieldProps) => (
                <TextField
                  variant="outlined"
                  margin="dense"
                  fullWidth
                  required
                  id={"user-settings-lastName-input"}
                  type="text"
                  placeholder="Last Name"
                  inputProps={{ "data-test": "user-settings-lastName-input" }}
                  error={(touched || value !== initialValue) && Boolean(error)}
                  helperText={touched || value !== initialValue ? error : ""}
                  {...field}
                />
              )}
            </Field>
            <Field name="email">
              {({ field, meta: { error, value, initialValue, touched } }: FieldProps) => (
                <TextField
                  variant="outlined"
                  margin="dense"
                  fullWidth
                  required
                  id={"user-settings-email-input"}
                  type="text"
                  placeholder="Email"
                  inputProps={{ "data-test": "user-settings-email-input" }}
                  error={(touched || value !== initialValue) && Boolean(error)}
                  helperText={touched || value !== initialValue ? error : ""}
                  {...field}
                />
              )}
            </Field>
            <Field name="phoneNumber">
              {({ field, meta: { error, value, initialValue, touched } }: FieldProps) => (
                <TextField
                  variant="outlined"
                  margin="dense"
                  fullWidth
                  required
                  id={"user-settings-phoneNumber-input"}
                  type="text"
                  placeholder="Phone Number"
                  inputProps={{ "data-test": "user-settings-phoneNumber-input" }}
                  error={(touched || value !== initialValue) && Boolean(error)}
                  helperText={touched || value !== initialValue ? error : ""}
                  {...field}
                />
              )}
            </Field>
            <Grid
              container
              spacing={2}
              direction="row"
              justifyContent="flex-start"
              alignItems="flex-start"
            >
              <Grid item>
                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  color="primary"
                  sx={{ marginTop: 3, marginLeft: 0, marginBottom: 2 }}
                  data-test="user-settings-submit"
                  disabled={!isValid || isSubmitting}
                >
                  Save
                </Button>
              </Grid>
            </Grid>
          </Form>
        </MarginHonoringDiv>
      )}
    </StyledFormik>
  );
};

export default UserSettingsForm;
