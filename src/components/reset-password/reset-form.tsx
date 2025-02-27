'use client';

import React from 'react';
import { VisibilityStyle } from '../styling/visibility-style';
import { classNames } from 'sitefinity-react-framework/utils/classNames';
import { invalidDataAttr, invalidateElement, serializeForm } from '../common/utils';

const ResetForm = (props: any) => {
    const { viewModel, context, securityQuestionInputId,
        newPasswordInputId, repeatPasswordInputId, securityQuestionLabel } = props;
    const labels = viewModel.Labels;
    const visibilityClassHidden = viewModel.VisibilityClasses[VisibilityStyle.Hidden];
    const formRef = React.useRef<HTMLFormElement>(null);
    const newPasswordInputRef = React.useRef<HTMLInputElement>(null);
    const repeatPasswordInputRef = React.useRef<HTMLInputElement>(null);
    const answerInputRef = React.useRef<HTMLInputElement>(null);
    const [invalidInputs, setInvalidInputs] = React.useState<{[key: string]: boolean | undefined;}>({});
    const [showFormContainer, setFormContainer] = React.useState<boolean>(true);
    const [showSuccessContainer, setSuccessContainer] = React.useState<boolean>(false);
    const [errorMessage, setErrorMessage] = React.useState<string>(labels.ErrorMessage);
    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!validateForm(formRef.current!)) {
            return;
        }

        let model = { model: serializeForm(formRef.current!) };
        let submitUrl = (formRef.current!.attributes as any)['action'].value;
        window.fetch(
            submitUrl,
            {
                method: 'POST',
                body: JSON.stringify(model),
                headers: {
                    'Content-Type': 'application/json'
                }
            })
            .then((response) => {
                let status = response.status;
                if (status === 204) {
                    setFormContainer(false);
                    setSuccessContainer(true);
                } else {
                    let invalidInput;
                    const emptyInputs = {};
                    if (status === 400) {
                        invalidInput = newPasswordInputRef.current!;
                    } else if (status === 403) {
                        invalidInput = answerInputRef.current!;
                    }

                    invalidateElement(emptyInputs, invalidInput!);
                    setInvalidInputs(emptyInputs);

                    response.json().then((res) => {
                        let errorMessage = res.error.message;
                        setErrorMessage(errorMessage);
                    });
                }
            });
    };

    const validateForm = (form: HTMLFormElement) => {
        let isValid = true;
        setInvalidInputs({});
        setErrorMessage('');
        const emptyInputs = {};

        const requiredInputs = form.querySelectorAll('input[data-sf-role=\'required\']');

        (requiredInputs as NodeListOf<HTMLInputElement>).forEach((input: HTMLInputElement) => {
            if (!input.value) {
                invalidateElement(emptyInputs, input);
                setInvalidInputs(emptyInputs);
                isValid = false;
            }
        });

        if (!isValid) {
            setErrorMessage(labels.AllFieldsAreRequiredErrorMessage);

            return isValid;
        }

        if (newPasswordInputRef.current!.value !== repeatPasswordInputRef.current!.value) {
            invalidateElement(emptyInputs, repeatPasswordInputRef.current!);
            setInvalidInputs(emptyInputs);
            setErrorMessage(labels.PasswordsMismatchErrorMessage);

            return false;
        }

        return isValid;
    };

    const inputValidationAttrs = (name: string) => {
        return {
            className: classNames('form-control',{
                [viewModel.InvalidClass]: invalidInputs[name]
                }
            ),
            [invalidDataAttr]: invalidInputs[name],
            name: name
        };
    };

    const formContainerClass = classNames({
        [visibilityClassHidden]: !showFormContainer
    });
    const formContainerStyle = {
        display: !visibilityClassHidden ? showFormContainer ? '' : 'none' : ''
    };

    const errorMessageClass = classNames('alert alert-danger my-3', {
        [visibilityClassHidden]: !errorMessage
    });
    const errorMessageStyles = {
        display: !visibilityClassHidden ? errorMessage ? '' : 'none' : ''
    };

    const successContainerClass = classNames({
        [visibilityClassHidden]: !showSuccessContainer
      });
    const successContainerStyle = {
        display: !visibilityClassHidden ? showSuccessContainer ? '' : 'none' : ''
    };

    return (<>
      <div data-sf-role="form-container"
        className={formContainerClass}
        style={formContainerStyle}
      >
        <h2 className="mb-3">{labels.ResetPasswordHeader}</h2>
        {<div data-sf-role="error-message-container"
          className={errorMessageClass}
          style={errorMessageStyles}
          role="alert" aria-live="assertive"  >
          {errorMessage}
        </div>
        }
        <form ref={formRef} onSubmit={handleSubmit} method="post" action={viewModel.ResetUserPasswordHandlerPath} role="form">
          {viewModel.RequiresQuestionAndAnswer && viewModel.SecurityQuestion &&
          <div className="mb-3">
            <label htmlFor={securityQuestionInputId} className="form-label">{securityQuestionLabel}</label>
            <input id={securityQuestionInputId} type="text"
              data-sf-role="required"
              {...inputValidationAttrs('Answer')}/>
          </div>
                        }
          <div className="mb-3">
            <label htmlFor={newPasswordInputId} className="form-label">{labels.NewPasswordLabel}</label>
            <input ref={newPasswordInputRef} id={newPasswordInputId} type="password"
              data-sf-role="required"
              {...inputValidationAttrs('NewPassword')}/>
          </div>
          <div className="mb-3">
            <label htmlFor={repeatPasswordInputId} className="form-label">{labels.RepeatNewPasswordLabel}</label>
            <input ref={repeatPasswordInputRef} id={repeatPasswordInputId} type="password"
              data-sf-role="required"
              {...inputValidationAttrs('NewPassword')}/>
          </div>

          <input type="hidden" name="SecurityToken" value={context.searchParams!['value']} />
          <input className="btn btn-primary w-100" type="submit" value={labels.SaveButtonLabel} />
        </form>
        <input type="hidden" name="ErrorMessage" value={labels.ErrorMessage} />
        <input type="hidden" name="AllFieldsAreRequiredErrorMessage" value={labels.AllFieldsAreRequiredErrorMessage} />
        <input type="hidden" name="PasswordsMismatchErrorMessage" value={labels.PasswordsMismatchErrorMessage} />
      </div>
      <div data-sf-role="success-message-container"
        className={successContainerClass}
        style={successContainerStyle}>
        <h2>{labels.SuccessMessage}</h2>
        {viewModel.LoginPageLink &&
        <a href={viewModel.LoginPageLink} className="text-decoration-none">{labels.BackLinkLabel}</a>
        }
      </div>
    </>);
};

export { ResetForm };
